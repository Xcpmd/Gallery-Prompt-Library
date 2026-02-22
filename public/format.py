import os, json
from uu import encode

prompt_path = "./prompts"
base_path = os.path.dirname(__file__)

shine = {
    "action": "动作",
    "clothes": "服饰",
    "decor": "布局",
    "env": "环境",
    "eye": "眼睛",
    "face": "面部",
    "goods": "物品",
    "hair": "头发",
    "negative": "负面",
    "NSFW": "NSFW",
    "person": "人物",
    "scene": "场景",
    "shape": "体型",
    "shoes": "鞋子",
    "socks": "袜子",
    "start": "起手式",
    "style": "风格",
}

def dormat(id: str, name: str, content):
    template = {
        "id": id,
        "name": name,
        "content": content
    }
    return template

# 加载分类
def load_catgories() -> list[str]:
    categories = os.listdir(os.path.join(base_path, prompt_path))
    return [category.split('.')[0] for category in categories if os.path.isfile(os.path.join(base_path, prompt_path, category))]

# 通过分类名加载内容
def load_prompt(category: str):
    path = os.path.join(base_path, prompt_path, f"{category}.json")
    if os.path.exists(path):
        with open(path, "r", encoding='utf-8') as f:
            return json.loads(f.read())

def save_file(category: str, data):
    path = os.path.join(base_path, prompt_path, f"{category}.json")
    with open(path, "w", encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)

def main():
    for category in load_catgories():
        data = load_prompt(category)
        new = dormat(category, shine[category], data)
        save_file(category, new)

if __name__ == "__main__":
    main()