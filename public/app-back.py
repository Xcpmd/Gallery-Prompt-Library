from turtle import width
from uu import encode
from xml.sax.handler import all_properties
import flask
from flask import render_template, request
import json, re, os
from search import search
from utils import time

prompt_path = "prompts"
base_path = os.path.dirname(__file__).replace("\\", '/')

all_prompt = {
    "normal": [],
    "r18": [],
}

data_global = {}

# 通过分类名加载内容
def load_prompt(category: str) -> dict:
    path = os.path.join(base_path, prompt_path, f"{category}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = f.read()
        return json.loads(data) if data else {}
    return

# 加载分类
def load_catgories() -> list[str]:
    categories = os.listdir(os.path.join(base_path, prompt_path))
    return [category.split('.')[0] for category in categories if os.path.isfile(os.path.join(base_path, prompt_path, category))]

def update_prompt():
    all_prompt["normal"] = []
    all_prompt["r18"] = []
    for category in load_catgories():
        data: dict = load_prompt(category)["content"]
        for age, key in data.items():
            for prompts in key.values():
                all_prompt[age] += [(p["en"], p["zh"]) for p in prompts]

app = flask.Flask(__name__)
host = "127.0.0.1"
port = 4321

#主页面
@app.route(r"/")
def main() -> str:
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

# api: 获取分类名
@app.route(r'/getCategories')
def getCategories() -> list[str]:
    isNSFW = int(request.args.get('nsfw', 0))
    loads = [load_prompt(category) for category in load_catgories()]
    categories = [i["id"] for i in loads]
    name_zh = [i["name"] for i in loads]
    data = list(zip(categories, name_zh))
    try:
        index = categories.index('NSFW')
    except: 
        index = 0
    if index:
        del data[index]
        if isNSFW:
            data.append(("NSFW", "NSFW"))
    return data

# api: 返回子分类
@app.route(r'/category/<category>')
def getCategory(category) -> str:
    isNSFW = int(request.args.get('nsfw', 0))
    print(isNSFW)
    data: dict = load_prompt(category)["content"]
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

from format import dormat

recycle_path = 'prompts/recycle'

# 添加/移除 分类
@app.route('/editCategory')
def editCategory():
    category = request.args.get('id', '') # id
    option_type = request.args.get('type', '') # 操作类型
    if category:
        name = request.args.get("name", category) # 翻译
        match option_type:
            case "add":
                # 如果存在则跳过
                if category in load_catgories():
                    return f"{category}已存在-normal"
                with open(os.path.join(base_path, prompt_path, f"{category}.json"), "w", encoding='utf-8') as f:
                    f.write(json.dumps(dormat(category, name, {}), ensure_ascii=False))
                return f"{category}已创建-good"
            case "edit":
                origin_category = request.args.get("fromId", "") # 获取原id
                if origin_category in load_catgories():
                    # 原/新 路径
                    p = os.path.join(base_path, prompt_path, f"{origin_category}.json")
                    ap = os.path.join(base_path, prompt_path, f"{category}.json")
                    # 加载内容
                    with open(p, "r", encoding='utf-8') as f:
                        data = json.loads(f.read())
                    data["id"], data["name"] = category, name
                    # 写入
                    with open(p, "w", encoding='utf-8') as f:
                        f.write(json.dumps(data, ensure_ascii=False))
                    # 将文件名改为id
                    os.rename(p, ap)
                    return f"已将{origin_category}改为{name}"
                else: return f'不存在{origin_category}'
            case "remove":
                # 如果存在则移至recycle文件夹
                if category in load_catgories():
                    origin_path = os.path.join(base_path, prompt_path, f"{category}.json")
                    aim_path = os.path.join(base_path, recycle_path, f"{category}-{time()}.json")
                    os.rename(origin_path, aim_path)
                    return f"{category}移除失败-bad" if os.path.exists(origin_path) else f"{category}已移除-good"
                else: return ""
    else: return "未收到数据"

# 添加子分类
@app.route(r"/addChildCategory/<category>")
def addChildCategory(category):
    Id = request.args.get("id", "new")
    isNsfw = int(request.args.get("nsfw", 0))
    data = load_prompt(category)
    path = os.path.join(base_path, prompt_path, f"{category}.json")
    if data:
        data["content"]['r18' if isNsfw else "normal"][Id] = []
        with open(path, 'w', encoding='utf-8') as f:
             f.write(json.dumps(data, ensure_ascii=False))
        return f"{category}已添加{Id}"

##############################################

# 获取提示词
@app.route(r'/prompt/<category>/<key>')
def getPrompt(category, key) -> str:
    isNSFW = int(request.args.get('nsfw', 0))
    print(isNSFW)
    data = load_prompt(category)["content"]
    items = data.items()
    result = []
    for key_local, item in items:
        if key_local == "normal":      
            result += item[key]
        elif key_local == 'r18' and isNSFW and key in item:
            result += item[key]
    result = list(set([(p["en"], p["zh"]) for p in result]))
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

if __name__ == "__main__":
    update_prompt()
    app.run(host, port, debug=True)