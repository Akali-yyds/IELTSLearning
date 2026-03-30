"""
ECDICT 覆盖率测试
验证各类变形词是否都能直接命中，无需词形还原
"""
import sqlite3

DB = "data/stardict.db"

TEST_CASES = {
    "过去式 / 过去分词": [
        "stopped", "played", "studied", "tried", "cancelled", "canceled",
        "went", "took", "saw", "knew", "came", "gave", "told", "found",
        "made", "ran", "brought", "bought", "caught", "taught", "led",
    ],
    "现在分词 -ing": [
        "running", "making", "writing", "stopping", "studying",
        "encouraging", "surprising", "playing", "going",
    ],
    "第三人称单数 -s/-es": [
        "goes", "watches", "plays", "cancels", "encourages",
        "studies", "tries", "runs",
    ],
    "名词复数": [
        "children", "men", "women", "feet", "teeth", "mice",
        "dogs", "cats", "countries", "stories", "analyses",
    ],
    "-ly 副词": [
        "encouragingly", "surprisingly", "happily", "quickly",
        "slowly", "easily", "angrily", "broadly", "importantly",
        "significantly", "increasingly", "remarkably",
    ],
    "形容词比较级/最高级": [
        "bigger", "biggest", "better", "best", "worse", "worst",
        "faster", "fastest", "happier", "happiest",
    ],
    "不规则形容词": [
        "more", "most", "less", "least",
    ],
}

def check(conn, word):
    row = conn.execute(
        "SELECT word, translation, exchange FROM stardict WHERE word=? COLLATE NOCASE",
        (word,)
    ).fetchone()
    if row:
        t = (row["translation"] or "").splitlines()[0][:30]
        exch = row["exchange"] or ""
        return True, t, exch
    return False, "", ""


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    total = 0
    found = 0
    missing_all = []

    for category, words in TEST_CASES.items():
        missing = []
        print(f"\n{'='*60}")
        print(f"  {category}")
        print(f"{'='*60}")
        for w in words:
            total += 1
            ok, trans, exch = check(conn, w)
            if ok:
                found += 1
                exch_str = f" → {exch}" if exch else ""
                print(f"  ✓  {w:<22} {trans}{exch_str}")
            else:
                missing.append(w)
                print(f"  ✗  {w}")
        if missing:
            missing_all.extend(missing)

    conn.close()

    print(f"\n{'='*60}")
    print(f"  总计: {found}/{total} 命中率 {found/total*100:.1f}%")
    if missing_all:
        print(f"  未命中: {missing_all}")
    else:
        print("  全部命中！无需词形还原")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
