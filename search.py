from typing import List, Tuple, Set, Dict, Optional

# 尝试导入 python-Levenshtein 库（C 实现，速度极快）
try:
    import Levenshtein
    LEVENSHTEIN_AVAILABLE = True
except ImportError:
    LEVENSHTEIN_AVAILABLE = False
    # 回退到纯 Python 实现（用于无该库的环境）
    def levenshtein_distance(s1: str, s2: str) -> int:
        m, n = len(s1), len(s2)
        prev = list(range(n + 1))
        curr = [0] * (n + 1)
        for i in range(1, m + 1):
            curr[0] = i
            for j in range(1, n + 1):
                cost = 0 if s1[i - 1] == s2[j - 1] else 1
                curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            prev, curr = curr, prev
        return prev[n]

def edit_distance(s1: str, s2: str) -> int:
    """统一的编辑距离接口，优先使用 C 扩展"""
    if LEVENSHTEIN_AVAILABLE:
        return Levenshtein.distance(s1, s2)
    return levenshtein_distance(s1, s2)


class SearchIndex:
    """
    针对 (en, zh) 提示词列表构建的索引，支持精确匹配（含前缀）与模糊匹配。
    """
    def __init__(self, items: List[Tuple[str, str]]):
        self.items = items                     # 原始数据，索引与 items 一致
        self.en_word_to_indices: Dict[str, Set[int]] = {}   # 英文单词小写 -> 包含该单词的 item 索引集合
        self.zh_texts: List[str] = []           # 中文文本列表，索引与 items 一致
        self.all_en_words: Set[str] = set()     # 所有英文单词小写集合（用于 Trie 构建）
        self.trie: Dict = {}                    # 英文单词小写 Trie 树（用于前缀匹配）

        # 按长度分组英文单词，用于编辑距离候选过滤
        self.en_words_by_len: Dict[int, Set[str]] = {}
        # 按长度分组中文文本，用于编辑距离候选过滤
        self.zh_by_len: Dict[int, List[int]] = {}  # 长度 -> 索引列表

        for idx, (en, zh) in enumerate(items):
            self.zh_texts.append(zh)
            # 中文按长度分组
            zh_len = len(zh)
            self.zh_by_len.setdefault(zh_len, []).append(idx)

            # 英文分词（按空白分割，保留符号）
            words = en.split()
            for w in words:
                w_low = w.lower()
                self.all_en_words.add(w_low)
                # 英文按长度分组
                w_len = len(w_low)
                self.en_words_by_len.setdefault(w_len, set()).add(w_low)
                # 倒排索引
                if w_low not in self.en_word_to_indices:
                    self.en_word_to_indices[w_low] = set()
                self.en_word_to_indices[w_low].add(idx)

        # 构建 Trie 树（用于前缀匹配）
        for word in self.all_en_words:
            node = self.trie
            for ch in word:
                node = node.setdefault(ch, {})
            node['#'] = word  # 用 '#' 标记单词结束，并存储原单词（用于快速获取）

    def _get_words_with_prefix(self, prefix: str) -> List[str]:
        """返回 Trie 中所有以 prefix 开头的单词列表（小写）"""
        node = self.trie
        for ch in prefix:
            if ch not in node:
                return []
            node = node[ch]
        # 收集该节点下所有单词
        result = []
        stack = [node]
        while stack:
            curr = stack.pop()
            if '#' in curr:
                result.append(curr['#'])
            for k, v in curr.items():
                if k != '#':
                    stack.append(v)
        return result

    def exact_match_keyword(self, keyword: str) -> Set[int]:
        """精确匹配：英文单词完全相等 + 英文单词前缀匹配（关键词长度≥2） + 中文子串包含"""
        result: Set[int] = set()
        kw_low = keyword.lower()

        # 1. 英文单词完全匹配
        if kw_low in self.en_word_to_indices:
            result.update(self.en_word_to_indices[kw_low])

        # 2. 英文单词前缀匹配（关键词长度至少为2，避免单字母过度匹配）
        if len(kw_low) >= 2:
            prefix_words = self._get_words_with_prefix(kw_low)
            for word in prefix_words:
                if word in self.en_word_to_indices:
                    result.update(self.en_word_to_indices[word])

        # 3. 中文子串包含
        for idx, zh in enumerate(self.zh_texts):
            if keyword in zh:
                result.add(idx)

        return result

    def fuzzy_match_keyword(self, keyword: str, max_error: int) -> Set[int]:
        """
        模糊匹配：基于编辑距离返回与 keyword 相似（距离 <= max_error）的 item 索引集合。
        策略：分别对英文单词和中文文本进行候选过滤 + 编辑距离计算。
        """
        result: Set[int] = set()
        kw_low = keyword.lower()
        kw_len = len(kw_low)

        # 1. 英文单词模糊匹配
        # 候选：长度在 [kw_len - max_error, kw_len + max_error] 范围内的所有英文单词
        min_len = max(1, kw_len - max_error)
        max_len = kw_len + max_error
        candidate_words: Set[str] = set()
        for length in range(min_len, max_len + 1):
            if length in self.en_words_by_len:
                candidate_words.update(self.en_words_by_len[length])

        for word in candidate_words:
            if edit_distance(kw_low, word) <= max_error:
                result.update(self.en_word_to_indices[word])

        # 2. 中文文本模糊匹配
        # 候选：长度在 [kw_len - max_error, kw_len + max_error] 范围内的中文索引
        min_len_zh = max(1, kw_len - max_error)
        max_len_zh = kw_len + max_error
        candidate_indices: Set[int] = set()
        for length in range(min_len_zh, max_len_zh + 1):
            if length in self.zh_by_len:
                candidate_indices.update(self.zh_by_len[length])

        for idx in candidate_indices:
            if edit_distance(keyword, self.zh_texts[idx]) <= max_error:
                result.add(idx)

        return result

    def search(self, search_text: str, max_error: int = 1, match_all: bool = True) -> List[Tuple[str, str]]:
        """执行搜索，返回匹配的 (en, zh) 列表"""
        keywords = [kw.strip() for kw in search_text.split() if kw.strip()]
        if not keywords:
            return []

        # 精确匹配阶段
        exact_sets: List[Set[int]] = []
        all_have_exact = True
        for kw in keywords:
            exact_set = self.exact_match_keyword(kw)
            exact_sets.append(exact_set)
            if not exact_set:
                all_have_exact = False

        # 若所有关键字都有精确匹配，直接取交集/并集返回
        if all_have_exact:
            if match_all:
                common = set.intersection(*exact_sets) if exact_sets else set()
                if common:
                    return [self.items[i] for i in common]
            else:
                union = set.union(*exact_sets) if exact_sets else set()
                if union:
                    return [self.items[i] for i in union]

        # 否则，进入模糊匹配阶段（合并精确集与模糊集）
        fuzzy_sets: List[Set[int]] = []
        for i, kw in enumerate(keywords):
            combined = exact_sets[i].union(self.fuzzy_match_keyword(kw, max_error))
            fuzzy_sets.append(combined)

        if match_all:
            result_indices = set.intersection(*fuzzy_sets) if fuzzy_sets else set()
        else:
            result_indices = set.union(*fuzzy_sets) if fuzzy_sets else set()

        return [self.items[i] for i in result_indices]


# 全局缓存，避免重复构建索引（假设 item_list 内容不变时复用）
_INDEX_CACHE: Optional[SearchIndex] = None
_LAST_ITEM_LIST_ID: Optional[int] = None

def search(
    search_text: str,
    item_list: List[Tuple[str, str]],
    max_error: int = 1,
    match_all: bool = True
) -> List[Tuple[str, str]]:
    """
    支持错别字容错 + 多关键字的中英文模糊搜索（含前缀匹配）

    :param search_text: 搜索文本（多关键字用空格分隔）
    :param item_list: 待搜索的列表，每个元素为 (en, zh)
    :param max_error: 最大允许编辑距离（错别字数）
    :param match_all: True=所有关键字都匹配，False=匹配任意一个关键字
    :return: 匹配的 (en, zh) 列表
    """
    global _INDEX_CACHE, _LAST_ITEM_LIST_ID
    current_id = id(item_list)
    if _INDEX_CACHE is None or _LAST_ITEM_LIST_ID != current_id:
        _INDEX_CACHE = SearchIndex(item_list)
        _LAST_ITEM_LIST_ID = current_id
    return _INDEX_CACHE.search(search_text, max_error, match_all)