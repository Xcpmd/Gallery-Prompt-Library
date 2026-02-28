from app import app, request, prompt_path
import os, json

work_path = os.path.join(prompt_path, "works")
data_works = {}

def load_works(path) -> list[str]:
    files = os.listdir(path)
    for work in files:
        p = os.path.join(path, work)
        if not os.path.isfile(p):
            file = os.path.join(p, f"{work}.json")
            with open(file, 'r', encoding='utf-8') as f:
                data_works[work] = (json.loads(f.read()))

@app.route('/getWorks')
def getWorks():
    l = data_works.keys()
    return [(i, data_works[i]['name']) for i in l]