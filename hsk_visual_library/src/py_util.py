"""Pinyin chuẩn: ưu tiên CC-CEDICT (có thanh nhẹ), sửa chữ đa âm, áp biến điệu 一/不."""
import re, logging
logging.disable(logging.CRITICAL)
from hanzipy.dictionary import HanziDictionary
from pypinyin import pinyin, Style
import jieba
jieba.setLogLevel(60)

_d = HanziDictionary()
MARKS = {'a': 'āáǎàa', 'e': 'ēéěèe', 'i': 'īíǐìi', 'o': 'ōóǒòo', 'u': 'ūúǔùu', 'ü': 'ǖǘǚǜü'}

# chữ đơn đa âm: chọn cách đọc HSK
OVERRIDE = {'长': 'chang2', '只': 'zhi3', '种': 'zhong3', '行': 'xing2', '切': 'qie1', '背': 'bei4', '便': 'bian4',
            '数': 'shu4', '系': 'xi4', '好': 'hao3', '发': 'fa1', '差': 'cha4', '重': 'zhong4', '干': 'gan4', '倒': 'dao3',
            '都': 'dou1', '着': 'zhe5', '了': 'le5', '过': 'guo4', '为': 'wei4', '还': 'hai2', '得': 'de5', '地': 'de5',
            '和': 'he2', '大夫': 'dai4 fu5', '挣': 'zheng4', '正': 'zheng4', '分': 'fen1', '空': 'kong1', '场': 'chang3',
            '当': 'dang1', '占': 'zhan4', '朝': 'chao2', '片': 'pian4', '冲': 'chong1', '盖': 'gai4', '称': 'cheng1',
            '转': 'zhuan3', '假': 'jia3', '教': 'jiao1', '少': 'shao3', '难': 'nan2', '角': 'jiao3', '晕': 'yun1',
            '划': 'hua4', '吐': 'tu3', '喂': 'wei2', '哈': 'ha1', '圈': 'quan1', '号': 'hao4', '嗯': 'en4', '啊': 'a5',
            '呢': 'ne5', '吗': 'ma5', '吧': 'ba5', '的': 'de5', '把': 'ba3', '被': 'bei4', '要': 'yao4', '会': 'hui4',
            '看': 'kan4', '上': 'shang4', '下': 'xia4', '处': 'chu4', '答应': 'da1 ying5', '似的': 'shi4 de5',
            '一会儿': 'yi1 hui4r5', '一点儿': 'yi1 dian3r5', '哪儿': 'na3r5', '玩意儿': 'wan2 yi4r5', '结实': 'jie1 shi5',
            '东西': 'dong1 xi5', '地方': 'di4 fang5', '地道': 'di4 dao5', '大意': 'da4 yi5', '对头': 'dui4 tou5',
            '兄弟': 'xiong1 di5', '实在': 'shi2 zai4', '人家': 'ren2 jia5', '多少': 'duo1 shao5', '先生': 'xian1 sheng5',
            '生意': 'sheng1 yi5', '便宜': 'pian2 yi5', '合同': 'he2 tong5', '老子': 'lao3 zi5', '本事': 'ben3 shi5',
            '干部': 'gan4 bu4', '数据': 'shu4 ju4', '数字': 'shu4 zi4', '数量': 'shu4 liang4', '重新': 'chong2 xin1',
            '重复': 'chong2 fu4', '长大': 'zhang3 da4', '校长': 'xiao4 zhang3', '成长': 'cheng2 zhang3', '生长': 'sheng1 zhang3',
            '了解': 'liao3 jie3', '为了': 'wei4 le5', '因为': 'yin1 wei4', '以为': 'yi3 wei2', '作为': 'zuo4 wei2',
            '成为': 'cheng2 wei2', '行为': 'xing2 wei2', '认为': 'ren4 wei2', '银行': 'yin2 hang2', '行业': 'hang2 ye4',
            '还是': 'hai2 shi5', '觉得': 'jue2 de5', '记得': 'ji4 de5', '值得': 'zhi2 de5', '获得': 'huo4 de2',
            '得意': 'de2 yi4', '不得不': 'bu4 de2 bu4', '音乐': 'yin1 yue4', '头发': 'tou2 fa5', '睡觉': 'shui4 jiao4',
            '只有': 'zhi3 you3', '只好': 'zhi3 hao3', '只要': 'zhi3 yao4', '好奇': 'hao4 qi2', '爱好': 'ai4 hao4',
            '正好': 'zheng4 hao3', '好处': 'hao3 chu5', '到处': 'dao4 chu4', '处理': 'chu3 li3', '相处': 'xiang1 chu3',
            '角色': 'jue2 se4', '假装': 'jia3 zhuang1', '请假': 'qing3 jia4', '寒假': 'han2 jia4', '放暑假': 'fang4 shu3 jia4',
            '假如': 'jia3 ru2', '假设': 'jia3 she4', '教室': 'jiao4 shi4', '教育': 'jiao4 yu4', '教授': 'jiao4 shou4',
            '教练': 'jiao4 lian4', '教训': 'jiao4 xun5', '应该': 'ying1 gai1', '答案': 'da2 an4', '回答': 'hui2 da2',
            '答复': 'da2 fu4', '着急': 'zhao2 ji2', '着火': 'zhao2 huo3', '睡着': 'shui4 zhao2', '降落': 'jiang4 luo4',
            '朝代': 'chao2 dai4', '曾经': 'ceng2 jing1', '差不多': 'cha4 bu5 duo1', '出差': 'chu1 chai1',
            '参差': 'cen1 ci1', '倒霉': 'dao3 mei2', '到底': 'dao4 di3', '尽量': 'jin3 liang4', '尽快': 'jin3 kuai4',
            '尽管': 'jin3 guan3', '尽力': 'jin4 li4', '模样': 'mu2 yang4', '模特': 'mo2 te4', '没有': 'mei2 you3',
            '一样': 'yi2 yang4', '似乎': 'si4 hu1', '调整': 'tiao2 zheng3', '空调': 'kong1 tiao2', '强调': 'qiang2 diao4',
            '调查': 'diao4 cha2', '单调': 'dan1 diao4', '亲戚': 'qin1 qi5', '漂亮': 'piao4 liang5', '热闹': 're4 nao5',
            '暖和': 'nuan3 huo5', '葡萄': 'pu2 tao5', '咳嗽': 'ke2 sou5', '脑袋': 'nao3 dai5', '眼睛': 'yan3 jing5',
            '耳朵': 'er3 duo5', '时候': 'shi2 hou5', '衣服': 'yi1 fu5', '舒服': 'shu1 fu5', '收拾': 'shou1 shi5',
            '打扮': 'da3 ban5', '窗户': 'chuang1 hu5', '消息': 'xiao1 xi5', '事情': 'shi4 qing5', '姑娘': 'gu1 niang5',
            '休息': 'xiu1 xi5', '告诉': 'gao4 su5', '明白': 'ming2 bai5', '清楚': 'qing1 chu5', '麻烦': 'ma2 fan5',
            '喜欢': 'xi3 huan5', '意思': 'yi4 si5', '认识': 'ren4 shi5', '名字': 'ming2 zi5', '朋友': 'peng2 you5',
            '谢谢': 'xie4 xie5', '关系': 'guan1 xi5', '商量': 'shang1 liang5', '太太': 'tai4 tai5', '宝贝': 'bao3 bei4',
            '学生': 'xue2 sheng5', '知识': 'zhi1 shi5', '打算': 'da3 suan5', '已经': 'yi3 jing1', '什么': 'shen2 me5',
            '怎么': 'zen3 me5', '我们': 'wo3 men5', '咱们': 'zan2 men5', '爸爸': 'ba4 ba5', '妈妈': 'ma1 ma5',
            '哥哥': 'ge1 ge5', '姐姐': 'jie3 jie5', '弟弟': 'di4 di5', '妹妹': 'mei4 mei5', '叔叔': 'shu1 shu5',
            '奶奶': 'nai3 nai5', '爷爷': 'ye2 ye5', '舅舅': 'jiu4 jiu5', '姑姑': 'gu1 gu5', '姥姥': 'lao3 lao5',
            '宝宝': 'bao3 bao5', '任务': 'ren4 wu5', '主意': 'zhu3 yi5', '部分': 'bu4 fen5', '豆腐': 'dou4 fu5',
            '力气': 'li4 qi5', '客气': 'ke4 qi5', '不客气': 'bu2 ke4 qi5', '运气': 'yun4 qi5', '脾气': 'pi2 qi5',
            '规矩': 'gui1 ju5', '照顾': 'zhao4 gu5', '笑话': 'xiao4 hua5', '玻璃': 'bo1 li5', '萝卜': 'luo2 bo5',
            '糊涂': 'hu2 tu5', '马虎': 'ma3 hu5', '老实': 'lao3 shi5', '老婆': 'lao3 po5', '亲爱': 'qin1 ai4',
            '屁股': 'pi4 gu5', '胳膊': 'ge1 bo5', '护士': 'hu4 shi5', '师傅': 'shi1 fu5', '丈夫': 'zhang4 fu5',
            '妻子': 'qi1 zi5', '孩子': 'hai2 zi5', '号码': 'hao4 ma3', '数学': 'shu4 xue2', '和平': 'he2 ping2',
            '暂时': 'zan4 shi2', '没关系': 'mei2 guan1 xi5', '一下': 'yi2 xia4', '下载': 'xia4 zai3', '记录': 'ji4 lu4',
            '冠军': 'guan4 jun1', '背景': 'bei4 jing3', '漂': 'piao1', '应付': 'ying4 fu5', '似': 'si4', '转变': 'zhuan3 bian4',
            '恶心': 'e3 xin1', '血': 'xue4', '薄': 'bao2', '盛': 'sheng4', '模仿': 'mo2 fang3', '娱乐': 'yu2 le4',
            '快乐': 'kuai4 le4', '乐观': 'le4 guan1', '兴奋': 'xing1 fen4', '高兴': 'gao1 xing4', '感兴趣': 'gan3 xing4 qu4',
            '中间': 'zhong1 jian1', '一辈子': 'yi2 bei4 zi5', '了不起': 'liao3 bu5 qi3', '受不了': 'shou4 bu5 liao3',
            '来不及': 'lai2 bu5 ji2', '来得及': 'lai2 de5 ji2', '对不起': 'dui4 bu5 qi3', '看不起': 'kan4 bu5 qi3',
            '说不定': 'shuo1 bu5 ding4', '舍不得': 'she3 bu5 de5', '怪不得': 'guai4 bu5 de5', '不得了': 'bu4 de2 liao3',
            '东张西望': 'dong1 zhang1 xi1 wang4', '为什么': 'wei4 shen2 me5', '睡': 'shui4', '会议': 'hui4 yi4', '会计': 'kuai4 ji4',
            '还原': 'huan2 yuan2', '归还': 'gui1 huan2', '难道': 'nan2 dao4', '困难': 'kun4 nan5', '难过': 'nan2 guo4',
            '难受': 'nan2 shou4', '少年': 'shao4 nian2', '青少年': 'qing1 shao4 nian2', '多么': 'duo1 me5', '那么': 'na4 me5',
            '这么': 'zhe4 me5', '要是': 'yao4 shi5', '还有': 'hai2 you3', '于是': 'yu2 shi4', '部门': 'bu4 men2',
            '结果': 'jie2 guo3', '结束': 'jie2 shu4', '结婚': 'jie2 hun1', '便利': 'bian4 li4', '方便': 'fang1 bian4',
            '大方': 'da4 fang5', '扎实': 'zha1 shi5', '宽': 'kuan1', '切实': 'qie4 shi2', '一切': 'yi2 qie4',
            '系统': 'xi4 tong3', '系领带': 'ji4 ling3 dai4', '关系网': 'guan1 xi4 wang3', '胡说': 'hu2 shuo1',
            '打听': 'da3 ting5', '溜达': 'liu1 da5', '琢磨': 'zuo2 mo5', '折腾': 'zhe1 teng5', '凑合': 'cou4 he5',
            '委屈': 'wei3 qu5', '别扭': 'bie4 niu5', '佩服': 'pei4 fu2', '出息': 'chu1 xi5', '心思': 'xin1 si5',
            '个子': 'ge4 zi5', '日子': 'ri4 zi5', '样子': 'yang4 zi5', '屋子': 'wu1 zi5', '鼻子': 'bi2 zi5', '肚子': 'du4 zi5',
            '使劲儿': 'shi3 jin4r5', '干活儿': 'gan4 huo2r5', '玩儿': 'wan2r5', '一会儿': 'yi2 hui4r5',
            }


def num_to_mark(s):
    if s[:1].isupper():
        r = num_to_mark(s[0].lower() + s[1:])
        return r[:1].upper() + r[1:]
    s = s.replace('u:', 'ü').replace('v', 'ü')
    m = re.match(r'^([a-zü]+?)(r?)([1-5])$', s)
    if not m:
        return s
    base, er, t = m.group(1), m.group(2), int(m.group(3))
    if base == 'e' and er == 'r':  # "er" bản thân
        base, er = 'er', ''
    if t == 5:
        return base + er
    if 'a' in base:
        v = 'a'
    elif 'e' in base:
        v = 'e'
    elif 'ou' in base:
        v = 'o'
    else:
        v = [c for c in base if c in 'aeiouü'][-1]
    i = base.rfind(v) if v not in 'ae' else base.find(v)
    return base[:i] + MARKS[v][t - 1] + base[i + 1:] + er


def cedict(word):
    try:
        es = _d.definition_lookup(word)
    except Exception:
        return None
    low, cap = [], []
    for e in es:
        p = e['pinyin'].strip()
        if not p:
            continue
        (low if p[0].islower() else cap).append(p) if p not in low + cap else None
    return low or cap


def _merge_r(tokens):
    out = []
    for t in tokens:
        if t in ('r5', 'r') and out:
            out[-1] = re.sub(r'([1-5])$', r'r\1', out[-1])
        else:
            out.append(t)
    return out


def _norm(lst):
    return [re.sub(r'^([a-zü:]+?)([1-5])r5$', r'\1r\2', x) for x in lst]


def word_numeric(word):
    return _norm(_word_numeric(word))


def _word_numeric(word):
    if word in OVERRIDE:
        return OVERRIDE[word].split()
    pys = cedict(word)
    pp = [p[0] for p in pinyin(word, style=Style.TONE3, neutral_tone_with_five=True)]
    if pys:
        cands = [_merge_r(p.split()) for p in pys]
        cands = [c for c in cands if len(c) == len(word) or any(x.endswith('r5') or 'r' in x for x in c)]
        if cands:
            if len(cands) == 1:
                res = cands[0]
            else:
                # ưu tiên khớp pypinyin bỏ qua thanh nhẹ, rồi bản có thanh nhẹ
                def score(c):
                    s = sum(1 for a, b in zip(c, pp) if re.sub(r'\d', '', a.lower()) == re.sub(r'\d', '', b.replace('v', 'u:')))
                    s += sum(1 for a, b in zip(c, pp) if a == b) * 0.5
                    s += 0.3 * sum(1 for a in c if a.endswith('5'))
                    return s
                res = max(cands, key=score)
            return res
    # chữ-đơn-override trong từ ghép không có trong từ điển
    out = []
    for ch, p in zip(word, pp):
        out.append(OVERRIDE.get(ch, p).replace('v', 'u:') if len(word) == 1 else p.replace('v', 'u:'))
    return out


def sandhi(chars, nums):
    nums = list(nums)
    if len(chars) != len(nums):
        chars = [c for c in chars if c != '儿']
    if len(chars) != len(nums):
        return nums
    for i, ch in enumerate(chars):
        if i + 1 >= len(nums):
            break
        nt = re.sub(r'\D', '', nums[i + 1])
        if ch == '一' and nums[i] == 'yi1' and not (i > 0 and chars[i - 1] == '第'):
            nums[i] = 'yi2' if nt == '4' else 'yi4'
        if ch == '不' and nums[i] == 'bu4' and nt == '4':
            nums[i] = 'bu2'
    return nums


def word_pinyin(word):
    """-> chuỗi âm tiết có dấu, cách nhau dấu cách (dùng cho âm bồi)."""
    nums = sandhi(list(word), word_numeric(word))
    return ' '.join(num_to_mark(n) for n in nums)


PUNCT = '，。？！、；：“”‘’（）《》——…·,.?!;:()'


def sentence_pinyin(sent):
    parts = []
    for seg in jieba.lcut(sent):
        if all(c in PUNCT or c.isspace() for c in seg):
            parts.append(('p', seg))
            continue
        if re.fullmatch(r'[A-Za-z0-9%\.\- ]+', seg):
            parts.append(('w', seg))
            continue
        cjk = ''.join(c for c in seg if '一' <= c <= '鿿')
        if not cjk:
            parts.append(('w', seg)); continue
        nums = word_numeric(cjk)
        nums = sandhi(list(cjk), nums)
        joiner = '' if (len(cjk) == 1 or cjk in OVERRIDE or cedict(cjk)) else ' '
        parts.append(('w', joiner.join(num_to_mark(n) for n in nums)))
    out = ''
    for kind, t in parts:
        if kind == 'p':
            mp = {'，': ',', '。': '.', '？': '?', '！': '!', '、': ',', '；': ';', '：': ':', '“': '"', '”': '"',
                  '（': '(', '）': ')', '《': '«', '》': '»', '…': '…', '——': ' – '}
            out += ''.join(mp.get(c, c) for c in t) if t != '——' else ' – '
        else:
            out += (' ' if out and not out.endswith((' ', '"', '(', '«')) else '') + t
    out = re.sub(r'\s+([,.?!;:)»])', r'\1', out)
    out = out.strip()
    return out[:1].upper() + out[1:]


if __name__ == '__main__':
    for w in ['朋友', '一会儿', '东西', '不客气', '一切', '一样', '一般', '第一', '唯一', '不错', '了不起', '长', '地', '哪儿', '女儿', '儿子']:
        print(w, word_pinyin(w))
    print(sentence_pinyin('我觉得这个价格还是有点儿贵，你们能便宜一点儿吗？'))
    print(sentence_pinyin('他长得很高，我们一起去银行吧。'))
