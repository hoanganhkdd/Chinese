"""Chuyển pinyin có dấu -> âm bồi tiếng Việt (gần đúng).
Quy ước thanh: 1 = không dấu, 2 = sắc, 3 = hỏi, 4 = huyền, nhẹ = không dấu."""
import unicodedata

TONES = {}
for base, marks in {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}.items():
    for i, m in enumerate(marks):
        TONES[m] = (base, i + 1)

INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
            'j', 'q', 'x', 'r', 'z', 'c', 's']
INIT_MAP = {'b': 'p', 'p': 'ph', 'm': 'm', 'f': 'ph', 'd': 't', 't': 'th', 'n': 'n', 'l': 'l',
            'g': 'c', 'k': 'kh', 'h': 'h', 'j': 'ch', 'q': 'ch', 'x': 'x', 'zh': 'tr', 'ch': 'tr',
            'sh': 's', 'r': 'r', 'z': 'ch', 'c': 'x', 's': 'x'}
FINAL_MAP = {'a': 'a', 'o': 'ua', 'e': 'ưa', 'i': 'i', 'u': 'u', 'ü': 'uy', 'ai': 'ai', 'ei': 'ây',
             'ao': 'ao', 'ou': 'âu', 'an': 'an', 'en': 'ân', 'ang': 'ang', 'eng': 'âng', 'ong': 'ung',
             'er': 'ơ', 'ia': 'ia', 'ie': 'iê', 'iao': 'eo', 'iu': 'iêu', 'ian': 'iên', 'in': 'in',
             'iang': 'eng', 'ing': 'inh', 'iong': 'iung', 'ua': 'oa', 'uo': 'ua', 'uai': 'oai',
             'ui': 'uây', 'uan': 'oan', 'un': 'uân', 'uang': 'oang', 'ueng': 'uâng',
             'üe': 'uê', 'üan': 'oen', 'ün': 'uyn'}
ZERO = {'yi': 'i', 'ya': 'da', 'ye': 'dê', 'yao': 'dao', 'you': 'dâu', 'yan': 'dên', 'yin': 'in',
        'yang': 'dang', 'ying': 'inh', 'yong': 'dung', 'yu': 'duy', 'yue': 'duê', 'yuan': 'doen',
        'yun': 'duyn', 'wu': 'u', 'wa': 'oa', 'wo': 'ua', 'wai': 'oai', 'wei': 'uây', 'wan': 'oan',
        'wen': 'uân', 'wang': 'oang', 'weng': 'uâng', 'a': 'a', 'e': 'ưa', 'ai': 'ai', 'ao': 'ao',
        'ou': 'âu', 'an': 'an', 'en': 'ân', 'ang': 'ang', 'er': 'ơ', 'o': 'ô'}
MARK = {2: '́', 3: '̉', 4: '̀'}
VOWELS = set('aeiouyâêôơư')


def place_tone(s, tone):
    if tone not in MARK:
        return s
    # tìm cụm nguyên âm
    idx = [i for i, ch in enumerate(s) if ch in VOWELS]
    if s.startswith('qu') and len(idx) > 1:
        idx = idx[1:]
    # cụm liên tiếp đầu tiên
    cluster = [idx[0]]
    for i in idx[1:]:
        if i == cluster[-1] + 1:
            cluster.append(i)
        else:
            break
    chars = [s[i] for i in cluster]
    target = None
    for i in cluster:
        if s[i] in 'âêơư':
            target = i
            break
    if target is None:
        c = ''.join(chars)
        if len(cluster) == 1:
            target = cluster[0]
        elif c in ('ua', 'ia'):
            target = cluster[0]
        elif c.startswith('uy'):
            target = cluster[1]
        elif c.startswith('o') or c.startswith('u'):
            target = cluster[1]
        else:
            target = cluster[0]
    out = s[:target + 1] + MARK[tone] + s[target + 1:]
    return unicodedata.normalize('NFC', out)


def syllable(py):
    tone, base = 0, ''
    for ch in py.lower():
        if ch in TONES:
            b, tone = TONES[ch]
            base += b
        else:
            base += ch
    base = base.replace('v', 'ü').replace('u:', 'ü')
    if base.endswith('r') and base not in ('er',) and len(base) > 1:
        return syllable_core(base[:-1], tone) + 'r'
    return syllable_core(base, tone)


def syllable_core(base, tone):
    if base in ZERO or base[0] in 'yw':
        res = ZERO[base]
        return place_tone(res, tone)
    ini = next((i for i in INITIALS if base.startswith(i)), '')
    fin = base[len(ini):]
    if ini in ('j', 'q', 'x'):
        fin = {'u': 'ü', 'ue': 'üe', 'uan': 'üan', 'un': 'ün'}.get(fin, fin)
    if fin == 'i' and ini in ('zh', 'ch', 'sh', 'r', 'z', 'c', 's'):
        v = 'ư'
    elif fin == 'e' and tone == 0:
        v = 'ơ'
    else:
        v = FINAL_MAP[fin]
    i2 = INIT_MAP[ini]
    if ini == 'g' and v[0] in 'ou' and v not in ('u', 'ung', 'ua', 'uy'):
        res = 'qu' + v[1:]
    else:
        res = i2 + v
    return place_tone(res, tone)


def ambo(pinyin_spaced):
    words = pinyin_spaced.split('/')
    return ' '.join(' '.join(syllable(s) for s in w.split()) for w in words)


def display(pinyin_spaced):
    return ' '.join(w.replace(' ', '') for w in pinyin_spaced.split('/'))


if __name__ == '__main__':
    for t in ['nǐ hǎo', 'xiè xie', 'duì bu qǐ', 'bú kè qi', 'wǒ men', 'guān xi', 'xiǎo jiě',
              'yǐ jīng', 'xué', 'qù', 'zhè shì', 'guì', 'kuài', 'yàng pǐn', 'rén mín bì', 'huì lǜ',
              'xuǎn', 'diàn zǐ yóu jiàn', 'gōng sī', 'cǎi gòu']:
        print(t, '->', ambo(t))
