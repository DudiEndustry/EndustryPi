import evdev
from evdev import InputDevice, categorize, ecodes
import threading
import time

class RFIDReader:
    def __init__(self):
        self.device = None
        self.callback = None
        self.running = False
        self.thread = None
        self.find_reader()

    def find_reader(self):
        devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
        for device in devices:
            if "RFID" in device.name.upper():
                self.device = device
                break

    def start(self, callback):
        if not self.device:
            raise Exception("RFID Reader not found")
        
        self.callback = callback
        self.running = True
        self.thread = threading.Thread(target=self._read_loop)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()

    def _read_loop(self):
        rfid_data = []
        try:
            while self.running:
                try:
                    for event in self.device.read_loop():
                        if event.type == ecodes.EV_KEY and event.value == 1:  # Key down events only
                            if event.code == 28:  # Enter key
                                if rfid_data:
                                    card_id = ''.join(str(x) for x in rfid_data)
                                    if self.callback:
                                        self.callback(card_id)
                                    rfid_data = []
                            else:
                                key_lookup = evdev.events.keys[event.code]
                                try:
                                    rfid_data.append(int(key_lookup[-1]))
                                except ValueError:
                                    pass
                except OSError:
                    # Device disconnected
                    time.sleep(1)
                    self.find_reader()
        except Exception as e:
            print(f"Error in RFID reader: {e}")