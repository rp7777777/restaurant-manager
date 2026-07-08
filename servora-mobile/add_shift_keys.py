# -*- coding: utf-8 -*-
import os

SHIFT_TRANSLATIONS = {
    "en": {"morning": "Morning", "afternoon": "Afternoon", "night": "Night"},
    "ne": {"morning": "बिहान", "afternoon": "दिउँसो", "night": "राति"},
    "pt": {"morning": "Manhã", "afternoon": "Tarde", "night": "Noite"},
    "es": {"morning": "Mañana", "afternoon": "Tarde", "night": "Noche"},
    "fr": {"morning": "Matin", "afternoon": "Après-midi", "night": "Nuit"},
    "ar": {"morning": "صباح", "afternoon": "بعد الظهر", "night": "ليل"},
    "zh": {"morning": "早上", "afternoon": "下午", "night": "晚上"},
    "hi": {"morning": "सुबह", "afternoon": "दोपहर", "night": "रात"},
    "de": {"morning": "Morgen", "afternoon": "Nachmittag", "night": "Nacht"},
    "it": {"morning": "Mattina", "afternoon": "Pomeriggio", "night": "Notte"},
    "no": {"morning": "Morgen", "afternoon": "Ettermiddag", "night": "Natt"},
    "da": {"morning": "Morgen", "afternoon": "Eftermiddag", "night": "Nat"},
    "ja": {"morning": "朝", "afternoon": "午後", "night": "夜"},
    "ko": {"morning": "아침", "afternoon": "오후", "night": "저녁"},
}

folder = "src/constants/translations"

for lang, keys in SHIFT_TRANSLATIONS.items():
    fname = os.path.join(folder, f"{lang}.ts")
    with open(fname, encoding="utf-8") as f:
        lines = f.readlines()

    if any("morning:" in line for line in lines):
        print(f"SKIP {fname}: morning key already exists")
        continue

    insert_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith("error:"):
            insert_idx = i + 1
            break

    if insert_idx is None:
        print(f"WARNING: error: key not found in {fname}")
        continue

    block = [
        f'  morning:              "{keys["morning"]}",\n',
        f'  afternoon:            "{keys["afternoon"]}",\n',
        f'  night:                "{keys["night"]}",\n',
    ]

    new_lines = lines[:insert_idx] + block + lines[insert_idx:]

    with open(fname, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"Updated {fname}")

print("Done!")
