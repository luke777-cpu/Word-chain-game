#!/usr/bin/env python3
import os
import random
import re

HANGUL_RE = re.compile(r"^[가-힣]+$")

def clean_word(w: str) -> str:
    return w.strip()

def is_korean(w: str) -> bool:
    return bool(HANGUL_RE.match(w))

def last_char(w: str) -> str:
    return w[-1]

def first_char(w: str) -> str:
    return w[0]

def load_dictionary(filename="words_ko.txt"):
    words = []
    if os.path.exists(filename):
        with open(filename, "r", encoding="utf-8") as f:
            for line in f:
                w = clean_word(line)
                if w and is_korean(w):
                    words.append(w)
    return words

def pick_computer_word(dic, required_first, used):
    candidates = [w for w in dic if w not in used and first_char(w) == required_first]
    return random.choice(candidates) if candidates else None

def ask(prompt):
    try:
        return input(prompt)
    except EOFError:
        return ""

def main():
    print("=== 끝말잇기 게임 ===")
    print("- 사람 vs 사람 (기본) / 사람 vs 컴퓨터 (사전 파일 있으면 자동)")
    print("- 규칙: 다음 단어는 앞 단어의 마지막 글자로 시작해야 합니다.")
    print("- 한글만 허용, 이미 사용한 단어 금지. 종료하려면 '그만' 입력.\n")

    dictionary = load_dictionary("words_ko.txt")
    vs_computer = len(dictionary) > 0
    if vs_computer:
        print("[모드] 사람 vs 컴퓨터  (사전: words_ko.txt 사용)")
    else:
        print("[모드] 사람 vs 사람")

    used = set()
    required_first = None
    turn = 0  # 0: Player1, 1: Player2/Computer

    if vs_computer:
        print("\n먼저 시작하세요! (플레이어가 선공)")

    while True:
        if turn == 0:
            prompt = "당신의 차례 > "
        else:
            prompt = ("상대 차례 > " if not vs_computer else "컴퓨터 생각 중... (Enter를 눌러 진행) ")

        if vs_computer and turn == 1:
            # Computer turn
            input("")  # Press enter to continue
            if required_first is None:
                # 컴퓨터가 먼저 시작하는 경우는 없음
                print("컴퓨터: (시작 단어가 필요합니다.)")
                turn = 0
                continue
            word = pick_computer_word(dictionary, required_first, used)
            if not word:
                print(f"컴퓨터: '{required_first}'(으)로 시작하는 단어가 없네요. 컴퓨터 패배! 🎉")
                break
            print(f"컴퓨터 ▶ {word}")
        else:
            user_input = ask(prompt).strip()
            if user_input == "" and vs_computer and turn == 1:
                continue
            word = clean_word(user_input)
            if word in ("그만", "끝", "종료", "q", "Q"):
                print("게임을 종료합니다.")
                break
            if not is_korean(word):
                print("한글 단어만 입력하세요.")
                continue

        # Rule checks
        if required_first and first_char(word) != required_first:
            print(f"❌ 규칙 위반: '{required_first}'(으)로 시작해야 합니다.")
            if turn == 1 and vs_computer:
                print("컴퓨터가 규칙을 어났습니다. 당신의 승리! 🎉")
                break
            else:
                # 사람 vs 사람 모드에서는 해당 턴 패배 처리
                loser = "플레이어2" if turn == 1 else "플레이어1"
                print(f"{loser} 패배!")
                break

        if word in used:
            print("❌ 이미 사용한 단어입니다. 다른 단어를 입력하세요.")
            continue

        used.add(word)
        required_first = last_char(word)
        # 다음 턴
        turn = 1 - turn

if __name__ == "__main__":
    main()
