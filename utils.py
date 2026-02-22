from datetime import datetime

def time(dt: datetime = None) -> str:
    """
    将 datetime 对象格式化为 '{y}-{m}-{d}-{h}-{min}-{s}' 格式的字符串。
    如果不传入参数，则使用当前本地时间。
    """
    if dt is None:
        dt = datetime.now()
    return f"{dt.year}-{dt.month:02d}-{dt.day:02d}-{dt.hour:02d}-{dt.minute:02d}-{dt.second:02d}"