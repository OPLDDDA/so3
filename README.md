# Standoff 2 — ESP / Aimbot (iOS, Frida + IL2CPP)

Нативный оверлей на UIKit, ESP, эймбот, триггербот и радар. Всё управляется из `config.json`, сборка не требует пересборки при смене игры — только правки имен символов.

## Состав

- `scripts/lib.js` — поиск классов/методов/полей в IL2CPP, хуки, утилиты.
- `scripts/overlay.js` — UIKit-оверлей: боксы, имена, healthbar, радар.
- `scripts/esp.js` — чтение игроков, проекция `WorldToScreenPoint`, дистанции.
- `scripts/aimbot.js` — выбор цели по FOV, сглаживание, LookAt/set_rotation, триггер.
- `scripts/main.js` — точка входа, RPC `setConfig`.
- `tools/loader.py` — запуск с Windows через `frida.get_usb_device()`.
- `tools/dump-symbols.js` — дамп реальных имен классов и методов твоей сборки.
- `tools/package-gadget.sh` — инъекция FridaGadget в IPA (нужен macOS).

## Установка

### Джейлбрейк

1. На айфоне: Frida через Cydia/Sileo (`frida-server`).
2. На Windows: `pip install frida-tools`.
3. Подключи телефон по USB, доверь компьютеру.
4. `python tools/loader.py --mode spawn`

### Без джейлбрейка — готовый .ipa через GitHub Actions

Собрать `.ipa` на Windows нельзя — инъекция требует macOS. Воркфлоу делает это в облаке. На выходе только `.ipa`: dylib скачивается во временную папку, вшивается и удаляется.

1. Достань расшифрованный `.ipa` Standoff 2 (с зашифрованным из App Store не сработает).
2. Залей содержимое этой папки в новый репозиторий GitHub.
3. **Actions → Build IPA → Run workflow**. В полях:
   - `ipa_url` — прямая ссылка на твой расшифрованный `.ipa`;
   - `gadget_version` — `16.2.2`;
   - `output_name` — любое имя, например `Standoff2-Gadget`.
4. Скачай артефакт, распакуй — внутри готовый `.ipa`.
5. Подпиши и установи через Sideloadly на Windows (свой Apple ID).
6. `python tools/loader.py --mode gadget`

Локально на macOS то же самое одним вызовом: `bash tools/package-gadget.sh game.ipa 16.2.2`.


## Подгон под свою версию игры

Имена в `config.json → symbols` — отправная точка, а не гарантия. Сдампи свои:

```bash
python - <<'PY'
import frida, json, time
d = frida.get_usb_device(timeout=15)
p = d.spawn(["com.playtox.standoff2"])
s = d.attach(p)
src = open("tools/dump-symbols.js", encoding="utf-8").read()
sc = s.create_script(src); sc.load()
d.resume(p)
print(sc.exports.dump(["player", "camera", "weapon", "health", "team"]))
time.sleep(2)
PY
```

Потом замени `playerClass`, `playersListMethod`, `healthField`, `teamField` и т.д. на реальные имена из дампа. Если `get_main` у камеры недоступен — поставь `frameClass: "UnityEngine.Camera"` и `frameMethod: "Update"` (уже по умолчанию).

## Возможности

- **ESP**: боксы, имена, здоровье, дистанция, цвет по команде, лимит дистанции.
- **Aimbot**: выбор по FOV, bone head/chest, сглаживание 1–60, лимит дистанции.
- **Triggerbot**: выстрел при цели в прицеле, задержка в мс.
- **Radar**: круговой радар со смещениями dx/dz, диапазон и прозрачность.

## Что важно знать

- Отдельного `.ipa`-четера, который ставится сам по себе, не бывает без джейлбрейка: iOS не пускает приложение в память другой игры. `.ipa` здесь — перепакованная Standoff 2 с gadget внутри.
- Это не обход античита: онлайн-бан на competitive-серверах — нормальный исход.
- Точные имена символов зависят от версии игры; без дампа скрипт может не найти игроков.
- Работает только с Frida 16.2+ (API `Il2Cpp.perform`, `image().class()`).
- `bundleId` в конфиге может отличаться — проверь через `frida-ps -Ua`.

## Примеры конфигурации

Минимальный запуск: `esp.enabled = true`, остальное по умолчанию. Для тихого режима выключи `radar` и `names`, оставь `boxes`.
