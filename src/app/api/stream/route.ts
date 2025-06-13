import mqtt from 'mqtt';

// Store active connections
const connections = new Set<ReadableStreamDefaultController>();

// MQTT client for streaming
const streamMqttClient = mqtt.connect('mqtt://103.210.35.166:1883', {
    clientId: 'nextjs-stream-' + Math.random().toString(16).substr(2, 8),
    username: 'mqtt',
    password: 'mqtt',
});

let sensorData = {
    temperature: null as number | null,
    humidity: null as number | null,
    water_temp: null as number | null,
};

streamMqttClient.on('connect', () => {
    console.log('Stream MQTT client connected');
    streamMqttClient.subscribe(['sensor33/air', 'sensor33/water']);
});

streamMqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        if (topic === 'sensor33/air') {
            sensorData.temperature = data.temperature;
            sensorData.humidity = data.humidity;
        } else if (topic === 'sensor33/water') {
            sensorData.water_temp = data.temperature;
        }

        // Broadcast to all connected clients
        const eventData = {
            id: Date.now().toString(),
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            water_temp: sensorData.water_temp,
            timestamp: new Date().toISOString(),
        };

        connections.forEach(controller => {
            try {
                const chunk = `data: ${JSON.stringify(eventData)}\n\n`;
                controller.enqueue(new TextEncoder().encode(chunk));
            } catch (error) {
                connections.delete(controller);
            }
        });
    } catch (error) {
        console.error('Error processing stream message:', error);
    }
});

export async function GET() {
    const stream = new ReadableStream({
        start(controller) {
            connections.add(controller);
            
            // Send initial connection message
            const chunk = `data: ${JSON.stringify({ type: 'connected' })}\n\n`;
            controller.enqueue(new TextEncoder().encode(chunk));
        },
        cancel() {
            connections.forEach(conn => connections.delete(conn));
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
        },
    });
}