import flask
from flask import render_template, request, send_from_directory, make_response
import json, os
from search import search
from utils import time
import argparse
import webbrowser as web
from threading import Timer
from send2trash import send2trash

class RepeatingTimer(Timer):
   def run(self):
       while not self.finished.is_set():
           self.function(*self.args, **self.kwargs)
           self.finished.wait(self.interval)

parser = argparse.ArgumentParser()
parser.add_argument("--debug", action="store_true", help="开启调试")
parser.add_argument("--backup", action="store_true", help="开启备份")
args = parser.parse_args()

ENABLE_DEBUG = args.debug
ENABLE_BACKUP = args.backup

base_path = os.path.dirname(__file__).replace("\\", '/')
prompt_path: str = os.path.join(base_path, "prompts")
temp_path: str = os.path.join(prompt_path, "temp")
works_path: str = os.path.join(prompt_path, "works")
recycle_path: str = os.path.join(prompt_path, "recycle")

all_prompt = {
    "normal": [],
    "r18": [],
}

data_global = {}

# 通过分类名加载内容
def load_prompt(category: str) -> dict:
    path = os.path.join(prompt_path, f"{category}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data: dict = json.loads(f.read())
        category_id = data["id"]
        del data["id"]
        data_global[category_id] = data

# 加载分类
def load_catgories(path: str = prompt_path) -> list[str]:
    files = os.listdir(path)
    categories = [category.split('.')[0] for category in files if os.path.isfile(os.path.join(path, category))]
    return categories

def reload():
    global data_global
    data_global = {}
    load_works()
    [load_prompt(i) for i in load_catgories()]

def update_prompt():
    all_prompt["normal"] = []
    all_prompt["r18"] = []
    for category in data_global.keys():
        data: dict = data_global[category]["content"]
        for age, key in data.items():
            for prompts in key.values():
                all_prompt[age] += [(p["en"], p["zh"]) for p in prompts]

def save():
    files = load_catgories()
    keys = data_global.keys()
    for file in files:
        if not file in keys:
            p = os.path.join(prompt_path, f"{file}.json").replace('/', '\\')
            send2trash(p)
    for ID, content in data_global.items():
        temp = content.copy()
        temp['id'] = ID
        path = os.path.join(prompt_path, f"{ID}.json")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(temp, ensure_ascii=False))
    print("Saved")

app = flask.Flask(__name__)
host = "0.0.0.0"
port = 4321

#主页面
@app.route(r"/")
def main() -> str:
    reload()
    return render_template("index.html")

# api: 获取状态
@app.route(r"/status")
def getStatus():
    data = {
        "code": 200,
        "content": {
            "nsfw": int(request.args.get('nsfw', 0)),
            "promptCount": len(all_prompt["normal"]) + len(all_prompt["r18"])
        }
    }
    return data

# api: 字体
@app.route(r'/font/<font>')
def getFont(font):
    response = make_response(send_from_directory('static/webfonts', font))
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response

# api: 获取分类名
@app.route(r'/getCategories')
def getCategories() -> list[str]:
    isNSFW = int(request.args.get('nsfw', 0))
    result = []
    for i, j in data_global.items():
        n = 'nsfw' in j.keys()
        m = False
        if n:
            m = j['nsfw']
        if not isNSFW and m: continue
        result.append((i, j['name']))
    return result

# api: 返回子分类
@app.route(r'/category/<category>')
def getCategory(category) -> str:
    isNSFW = int(request.args.get('nsfw', 0))
    # print(isNSFW)
    data: dict = data_global[category]["content"]
    items = data.items()
    result = []
    if not isNSFW:
        for key, item in items:
            if key == "normal": 
                result = [k for k, _ in item.items()]   
    else:
        for _, item in items:
            result += [k for k, _ in item.items()]
    result = list(set(result))
    if "default" in result:
        i = result.index("default")
        del result[i]
        result = ['default'] + result
    return json.dumps(result, ensure_ascii=False)

############################
#   提示词编辑api
############################

# 添加/移除 分类
@app.route('/editCategory')
def editCategory():
    ID = request.args.get('id', '') # id
    option_type = request.args.get('type', '') # 操作类型
    name = request.args.get("name", ID) # 翻译
    match option_type:
        case "add":
            # 如果存在则跳过
            if ID in data_global.keys():
                return f"{ID}已存在%normal"
            data_global[ID] = {
                "name": name,
                "nsfw": False,
                "content": {
                    "normal": {
                        "default": []
                    },
                    "r18": {}
                }
            }
            # print(data_global.keys())
            save()
            return f"{ID}已创建%good"
        case "edit":
            fromID = request.args.get("fromId", "") # 获取原id
            # if ID in data_global.keys():
            #     return f"{ID}已存在-normal"
            if fromID in data_global.keys():
                if ID == fromID:
                    # 重命名
                    data_global[ID]["name"] = name
                else:
                    if ID in data_global.keys():
                        return f"{ID}已存在%normal"
                    # 缓存当前内容
                    temp = data_global[fromID]
                    # 移除原有内容
                    del data_global[fromID]
                    # 重命名
                    temp["name"] = name
                    # 添加内容/ 清除缓存
                    data_global[ID] = temp
                    del temp
                # print(data_global.keys())
                save()
                return f"已将{fromID}重命名为{name}"
            else: return f'不存在{fromID}'
        case "remove":
            # 如果存在则移移除
            if ID in data_global.keys():
                # 移除
                del data_global[ID]
                save()
                return f"{name}移除失败%bad" if ID in data_global.keys() else f"{name}已移除%good"
            else: return ""

# 添加子分类
@app.route(r"/editChildCategory/<category>")
def editChildCategory(category):
    option_type = request.args.get('type', '') # 操作类型
    name = request.args.get("name") # 翻译
    match option_type:
        case "add":
            # 如果存在则跳过
            isNsfw = int(request.args.get("nsfw", 0))
            n = "r18" if isNsfw else "normal"
            # 添加
            if not data_global[category]["content"].get(n):
                data_global[category]["content"][n] = {}
            data_global[category]["content"][n][name] = []
            save()
            return f"{category}已添加{name}%good"
        case "edit":
            fromName = request.args.get("from", "") # 获取原名称
            # 缓存当前内容
            try:
                temp_n = data_global[category]["content"]['normal'][fromName]
                del data_global[category]["content"]['normal'][fromName]
                data_global[category]["content"]['normal'][name] = temp_n
                del temp_n
            except: pass
            try:
                temp_r = data_global[category]["content"]['r18'][fromName]
                del data_global[category]["content"]['r18'][fromName]
                data_global[category]["content"]['r18'][name] =temp_r
                del temp_r
            except: pass
            # 移除原有内容
            # 添加内容/ 清除缓存
            save()
            return f"已将{fromName}重命名为{name}"
        case "remove":
            # 如果存在则移移除
            haskey = []
            nn = data_global[category]["content"].get('normal')
            rr = data_global[category]["content"].get('r18')
            if nn:
                haskey += nn.keys()
            if rr:
                haskey += rr.keys()
            if name in haskey:
                # 移除
                try:
                    del data_global[category]["content"]['normal'][name]
                    del data_global[category]["content"]['r18'][name]
                except: pass
                save()
                # 验证
                haskey = []
                nn = data_global[category]["content"].get('normal')
                rr = data_global[category]["content"].get('r18')
                if nn:
                    haskey += nn.keys()
                if rr:
                    haskey += rr.keys()
                return f"{name}移除失败%bad" if name in haskey else f"{name}已移除%good"
            else: return ""

# 添加提示词
@app.route(r"/editPrompt")
def editPrompt():
    en = request.args.get('en', '')
    zh = request.args.get('zh', '')
    isNSFW = int(request.args.get('nsfw', 0))
    category = request.args.get('category')
    key = request.args.get('key')
    option_type = request.args.get('type', '')
    n = "r18" if isNSFW else "normal"

    match option_type:
        case "add":
            try:
                data_global[category]["content"][n][key].index({
                "en": en,
                "zh": zh
            })
                return f"{en}-{zh}已存在%bad"
            except:
                data_global[category]["content"][n][key].append({
                    "en": en,
                    "zh": zh
                })
            save()
            return f"已添加{en}%good"
        case "edit":
            fromEn = request.args.get('fromEn')
            fromZh = request.args.get('fromZh')
            fromNSFW = int(request.args.get('fromNSFW'))
            no = "r18" if fromNSFW else "normal"
            # print(data_global[category]["content"][no], key, "#"*10)
            content = {
                    "en": en,
                    "zh": zh
                }     
            index = data_global[category]["content"][no][key].index({
                "en": fromEn,
                "zh": fromZh
            })

            if fromNSFW == isNSFW:
                data_global[category]["content"][no][key][index] = content
            else:
                del data_global[category]["content"][no][key][index]
                if not key in data_global[category]["content"][n].keys():
                    data_global[category]["content"][n][key] = []
                data_global[category]["content"][n][key].insert(index, content)
            save()
            return f"已将{fromEn}-{fromZh}修改为{en}-{zh}%good"
            # return f"无效内容%bad"
        case "remove":
            fromEn = request.args.get('fromEn')
            fromZh = request.args.get('fromZh')
            fromNSFW = int(request.args.get('fromNSFW'))
            no = "r18" if fromNSFW else "normal"
            index = data_global[category]["content"][no][key].index({
                "en": fromEn,
                "zh": fromZh
            })

            del data_global[category]["content"][no][key][index]
            save()
            return f"已移除{fromEn}-{fromZh}%good"
##############################################

def aa(d:dict, n):
    t = d.copy()
    t["r"] = n
    return t

# 获取提示词
@app.route(r'/prompt')
def getPrompt() -> str:
    category = request.args.get('category')
    key = request.args.get('key')
    isNSFW = int(request.args.get('nsfw', 0))
    print(isNSFW)
    data = data_global[category]["content"]
    items = data.items()
    result = []
    for key_local, item in items:
        if key_local == "normal":
            result += [aa(i, 0) for i in item.get(key)]
        elif key_local == 'r18' and isNSFW and key in item.keys():
            result += [aa(i, 1) for i in item.get(key)]
    result = list(set([(p["en"], p["zh"], p["r"]) for p in result]))
    return json.dumps(result, ensure_ascii=False)

# 搜索功能
@app.route(r"/search/<value>")
def getSearch(value) -> str:
    update_prompt()
    isNSFW = int(request.args.get('nsfw', 0))
    print(value, isNSFW)
    data = all_prompt["normal"]
    data += all_prompt["r18"] if isNSFW else []
    result = list(set(search(value, data)))
    print(result)
    return json.dumps(result, ensure_ascii=False)

###########################################
# 作品处理
###########################################

work_path = os.path.join(base_path, "static/works")
data_works = {}

def load_works(path: str = work_path):
    files = os.listdir(path)
    for work in files:
        p = os.path.join(path, work)
        if not os.path.isfile(p):
            file = os.path.join(p, "chara.json")
            with open(file, 'r', encoding='utf-8') as f:
                data_works[work] = json.loads(f.read())

def get_work_names(path: str = work_path):
    files = os.listdir(path)
    return [os.path.splitext(file)[0] for file in files if os.path.isdir(os.path.join(path, file))]

@app.route('/getWorks')
def getWorks():
    return [(i, data_works[i]['name']) for i in data_works.keys()]

@app.route('/getCharas')
def getCharas():
    work = request.args.get("work")
    data = data_works[work]["content"]
    img_p = os.path.join(work_path, work, f"images")
    imgs = {}
    [imgs.update({img.split('.')[0]: img}) for img in os.listdir(img_p)]
    result = []
    for c in data:
        ID, name = c["id"], c["name"]
        p = ''
        if ID in imgs.keys():
            p = flask.url_for('static', filename=f"/works/{work}/images/{imgs[ID]}")
        result.append((ID, name, p))
    return result

@app.route(r'/editWork')
def editWork():
    id = request.args.get("id")
    name = request.args.get("name")
    option_type = request.args.get("type")
    match option_type:
        case 'add':
            if not id in data_works.keys():
                data_works[id] = {
                        "id": id,
                        "name": name,
                        "content": []
                        }
                p = os.path.join(work_path, f'{id}/images')
                os.makedirs(p)
                save_chara()
                return f"已成功添加{name}%good"
            else:
                save_chara()
                return f"{id}已存在%bad"
        case "edit":
            fromID = request.args.get("fromID")
            if not fromID in data_works.keys():
                return f"{fromID}不存在%bad"
            temp = data_works.pop(fromID, dict())
            temp["name"] = name
            data_works[id] = temp
            save_chara()
            return f"{fromID}已重命名为{name}%good"
        case "remove":
            fromID = request.args.get("fromID")
            if not fromID in data_works.keys():
                return f"{fromID}不存在%bad"
            data_works.pop(fromID, dict())
            save_chara()
            return f"已成功移除{name}%good"

@app.route(r'/editChara', methods = ['POST'])
def editChara():
    work = request.args.get("work")
    ID = request.args.get("id")
    name = request.args.get("name")
    option_type = request.args.get("type")
    match option_type:
        case 'add':
            if ID in [i['id'] for i in data_works[work]['content']]:
                return f"{ID}已存在%bad"
            data_works[work]['content'].append({
                "id": ID,
                "name": name,
            })
            img = request.files.get("image")
            if img:
                img_type = img.filename.split(".")[-1]
                p = os.path.join(work_path, work, "images")
                os.makedirs(p, exist_ok=True)
                img_p = os.path.join(work_path, work, f"images/{ID}.{img_type}")
                img.save(img_p)
            save_chara()
            return f"已成功创建{name}%good"
        case 'edit':
            fromID = request.args.get('fromId')
            fromName = request.args.get('fromName')
            partten = {
                "id": fromID,
                "name": fromName,
            }
            try:
                index = data_works[work]['content'].index(partten)
            except: index = ''
            if type(index) == int:
                # 移除并复制
                temp = data_works[work]['content'].pop(index)
                temp["name"] = name
                temp['id'] = ID
                data_works[work]['content'].insert(index, temp)

                img = request.files.get("image")
                if img:
                    img_p = os.path.join(work_path, work, f"images/")
                    for file in os.listdir(img_p):
                        p = os.path.join(img_p, file).replace('/', '\\')
                        if os.path.isfile(p) and os.path.splitext(file)[0] == fromID:
                            send2trash(p)
                            break
                    img_type = img.filename.split(".")[-1]
                    p = os.path.join(work_path, work, "images")
                    os.makedirs(p, exist_ok=True)
                    img_p = os.path.join(work_path, work, f"images/{ID}.{img_type}")
                    img.save(img_p)
                save_chara()
                return f"已修改{fromID}%good"
            return f"{fromID}不存在%bad"
        case 'remove':
            fromID = request.args.get('fromId')
            fromName = request.args.get('fromName')
            partten = {
                "id": fromID,
                "name": fromName,
            }
            try:
                index = data_works[work]['content'].index(partten)
            except: index = None
            if index:
                # 移除
                del data_works[work]['content'][index]
                img_p = os.path.join(work_path, work, f"images/")
                for img in os.listdir(img_p):
                    p = os.path.join(img_p, img).replace('/', '\\')
                    if os.path.isfile(p) and os.path.splitext(img)[0] == fromID:
                        send2trash(p)
                        break
                save_chara()
                return f"{fromID}已移除%good"

def save_chara():
    files = get_work_names()
    keys = data_works.keys()
    for file in files:
        if not file in keys:
            p = os.path.join(work_path, file).replace('/', '\\')
            send2trash(p)
    for ID, content in data_works.items():
        temp = content.copy()
        temp['id'] = ID
        path = os.path.join(work_path, ID, "chara.json")
        os.makedirs(os.path.join(work_path, ID, 'images'), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(temp, ensure_ascii=False))
    print("Saved")

def auto_save_func():
    save()
    save_chara()

AUTO_SAVE = RepeatingTimer(60, auto_save_func)

if __name__ == "__main__":
    # 加载提示词
    reload()
    update_prompt()

    # 自动保存
    AUTO_SAVE.start()
    # web.open(f"http://{host}:{port}")
    app.run(host, port, debug=ENABLE_DEBUG)
    save()
    save_chara()