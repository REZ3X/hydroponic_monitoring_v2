import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

interface HydroponicData {
  timestamp: Date;
  temperature: number;
  humidity: number;
  water_temp: number;
}

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
    host: process.env.NEXT_PUBLIC_DB_HOST,
    user: process.env.NEXT_PUBLIC_DB_USER,
    password: process.env.NEXT_PUBLIC_DB_PASSWORD,
    database: process.env.NEXT_PUBLIC_DB_NAME,
    port: process.env.NEXT_PUBLIC_DB_PORT ? parseInt(process.env.NEXT_PUBLIC_DB_PORT) : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
});

/**
 * Handles GET requests to retrieve the latest weather data.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const [results] = await pool.execute(
      'SELECT * FROM hydroponic_data WHERE timestamp >= NOW() - INTERVAL 10 SECOND ORDER BY timestamp ASC LIMIT 10'
    );
    
    return NextResponse.json(results);
  } catch (err) {
    console.error('Error retrieving data:', err);
    return NextResponse.json({ error: 'Error retrieving data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { temperature, humidity, water_temp }: Partial<HydroponicData> = await req.json();

    if (typeof temperature !== 'number' || typeof humidity !== 'number' || typeof water_temp !== 'number') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO hydroponic_data (temperature, humidity, water_temp) VALUES (?, ?, ?)',
      [temperature, humidity, water_temp]
    );

    return NextResponse.json({ message: 'Data inserted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Error inserting data:', err);
    return NextResponse.json({ error: 'Error inserting data' }, { status: 500 });
  }
}