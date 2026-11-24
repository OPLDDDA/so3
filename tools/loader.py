#!/usr/bin/env python3
"""Frida loader for Standoff2Cheat. Runs on Windows with Python 3.9+."""

import argparse
import json
import os
import sys
import time

try:
    import frida
except ImportError:
    print("Missing frida: pip install frida-tools")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = ["lib.js", "overlay.js", "esp.js", "aimbot.js", "main.js"]


def on_message(message, data):
    if message.get("type") == "error":
        print("[js error]", message.get("description", ""))
    elif message.get("type") == "send":
        print("[js]", message.get("payload"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.path.join(ROOT, "config.json"))
    parser.add_argument("--mode", choices=["spawn", "attach", "gadget"], default="spawn")
    parser.add_argument("--bundle", default=None)
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        config = json.load(f)

    bundle = args.bundle or config.get("bundleId", "com.playtox.standoff2")
    device = frida.get_usb_device(timeout=15)
    print("device:", device)

    pid = None
    if args.mode == "spawn":
        pid = device.spawn([bundle])
        session = device.attach(pid)
    elif args.mode == "attach":
        session = device.attach(bundle)
    else:
        session = device.attach("Gadget")

    scripts = []
    for name in SCRIPTS:
        path = os.path.join(ROOT, "scripts", name)
        with open(path, "r", encoding="utf-8") as f:
            source = f.read()
        script = session.create_script(source)
        script.on("message", on_message)
        script.load()
        scripts.append(script)
        print("loaded", name)

    main_script = scripts[-1]
    main_script.exports.set_config(config)
    print("config pushed")

    if pid is not None:
        device.resume(pid)
        print("resumed", bundle)

    print("running. ctrl-c to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        for script in reversed(scripts):
            try:
                script.unload()
            except Exception:
                pass
        print("stopped")


if __name__ == "__main__":
    main()
