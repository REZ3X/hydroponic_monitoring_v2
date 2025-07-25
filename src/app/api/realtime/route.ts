import { NextResponse } from 'next/server';

// This will store our latest data (in a real app, you might use Redis or similar)
let realtimeData = {
    temperature: null as number | null,
    humidity: null as number | null,
    water_temp: null as number | null,
    timestamp: null as string | null,
    connected: false,
    lastError: null as string | null
};

// This would be called by your MQTT handler to update the data
export function updateRealtimeData(data: {
    temperature?: number;
    humidity?: number;
    water_temp?: number;
}) {
    if (data.temperature !== undefined) realtimeData.temperature = data.temperature;
    if (data.humidity !== undefined) realtimeData.humidity = data.humidity;
    if (data.water_temp !== undefined) realtimeData.water_temp = data.water_temp;
    realtimeData.timestamp = new Date().toISOString();
    realtimeData.connected = true;
    realtimeData.lastError = null;
}

// Add this function to set connection errors
export function setMqttError(error: string) {
    realtimeData.connected = false;
    realtimeData.lastError = error;
}

export async function GET() {
    try {
        // Check if data is recent (within last 30 seconds)
        const isRecent = realtimeData.timestamp && 
            (Date.now() - new Date(realtimeData.timestamp).getTime()) < 30000;
        
        if (!isRecent && realtimeData.timestamp) {
            realtimeData.connected = false;
        }

        return NextResponse.json([{
            id: Date.now().toString(),
            temperature: realtimeData.temperature || 0,
            humidity: realtimeData.humidity || 0,
            water_temp: realtimeData.water_temp || 0,
            timestamp: realtimeData.timestamp || new Date().toISOString(),
            connected: realtimeData.connected,
            error: realtimeData.lastError
        }]);
    } catch (error) {
        console.error('Error getting realtime data:', error);
        return NextResponse.json({ error: 'Error retrieving realtime data' }, { status: 500 });
    }
}