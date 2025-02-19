import mysql from 'mysql2';

interface HydroponicData {
  timestamp: Date;
  temperature: number;
  humidity: number;
  water_temp: number;
}

const db = mysql.createConnection({
    host: process.env.NEXT_PUBLIC_DB_HOST,
    user: process.env.NEXT_PUBLIC_DB_USER,
    password: process.env.NEXT_PUBLIC_DB_PASSWORD,
    database: process.env.NEXT_PUBLIC_DB_NAME,
    port: process.env.NEXT_PUBLIC_DB_PORT ? parseInt(process.env.NEXT_PUBLIC_DB_PORT) : undefined,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log(`Connected to database on port ${process.env.NEXT_PUBLIC_DB_PORT}`);
  }
});

/**
 * Handles GET requests to retrieve the latest weather data.
 *
 * @returns {Promise<Response>} A promise that resolves to a Response object containing the weather data or an error message.
 */
export async function GET() {
  return new Promise((resolve) => {
    // Changed query to get only the latest 10 records with a shorter time window
    db.query(
      'SELECT * FROM hydroponic_data WHERE timestamp >= NOW() - INTERVAL 10 SECOND ORDER BY timestamp ASC LIMIT 10', 
      (err, results) => {
        if (err) {
          console.error('Error retrieving data:', err);
          resolve(new Response(JSON.stringify({ error: 'Error retrieving data' }), { status: 500 }));
        } else {
          resolve(new Response(JSON.stringify(results), { status: 200 }));
        }
    });
  });
}

import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { temperature, humidity, water_temp }: Partial<HydroponicData> = await req.json();

  if (typeof temperature !== 'number' || typeof humidity !== 'number' || typeof water_temp !== 'number') {
    return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400 });
  }

  return new Promise((resolve) => {
    db.query(
      'INSERT INTO hydroponic_data (temperature, humidity, water_temp) VALUES (?, ?, ?)',
      [temperature, humidity, water_temp],
      (err) => {
        if (err) {
          console.error('Error inserting data:', err);
          resolve(new Response(JSON.stringify({ error: 'Error inserting data' }), { status: 500 }));
        } else {
          resolve(new Response(JSON.stringify({ message: 'Data inserted successfully' }), { status: 200 }));
        }
      }
    );
  });
}