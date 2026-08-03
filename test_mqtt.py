import paho.mqtt.client as mqtt
import json

# Using a free public broker for easy testing
BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "winteq/verivision/factory/line1"

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"✅ Successfully connected to MQTT Broker: {BROKER}")
        client.subscribe(TOPIC)
        print(f"📡 Subscribed to topic: '{TOPIC}'")
        print("⏳ Waiting for inspection results from AI...")
    else:
        print(f"❌ Failed to connect, return code {reason_code}")

def on_message(client, userdata, msg):
    print("\n" + "="*50)
    print("🚨 NEW MESSAGE RECEIVED FROM VERIVISION AI! 🚨")
    print(f"Topic: {msg.topic}")
    try:
        # Try to parse the JSON nicely
        payload = json.loads(msg.payload.decode())
        print("Payload:")
        print(json.dumps(payload, indent=2))
        
        # Simulate physical action
        if payload.get("verdict") == "NG":
            print("\n⚙️ [FACTORY PLC SIMULATION]: Defect detected! Activating pneumatic piston to reject part...")
        else:
            print("\n⚙️ [FACTORY PLC SIMULATION]: Part is OK. Conveyor belt continues moving...")
            
    except Exception:
        print(f"Raw Payload: {msg.payload.decode()}")
    print("="*50 + "\n")

# Setup the client
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

print("Connecting to broker...")
client.connect(BROKER, PORT, 60)

# Block and listen forever
client.loop_forever()
