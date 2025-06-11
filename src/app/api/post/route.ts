import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
    host: process.env.NEXT_PUBLIC_DB_HOST,
    user: process.env.NEXT_PUBLIC_DB_USER,
    password: process.env.NEXT_PUBLIC_DB_PASSWORD,
    database: process.env.NEXT_PUBLIC_DB_NAME,
    port: process.env.NEXT_PUBLIC_DB_PORT ? parseInt(process.env.NEXT_PUBLIC_DB_PORT) : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handles POST requests to insert temperature and humidity data into the database.
 *
 * @param {NextRequest} req - The incoming request object.
 * @returns {Promise<NextResponse>} - A promise that resolves to a NextResponse object.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON data' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { temperatureDHT, humidity, temperatureDS18B20 } = body;

    // Validate the data
    if (
      typeof temperatureDHT !== 'number' ||
      typeof humidity !== 'number' ||
      typeof temperatureDS18B20 !== 'number'
    ) {
      return NextResponse.json(
        { 
          error: 'Invalid data types', 
          received: { temperatureDHT, humidity, temperatureDS18B20 } 
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use pool.execute with async/await
    await pool.execute(
      'INSERT INTO hydroponic_data (temperature, humidity, water_temp) VALUES (?, ?, ?)',
      [temperatureDHT, humidity, temperatureDS18B20]
    );

    return NextResponse.json(
      { 
        message: 'Data inserted successfully',
        data: { temperatureDHT, humidity, temperatureDS18B20 }
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error inserting data:', error);
    return NextResponse.json(
      { error: 'Error inserting data' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, { headers: corsHeaders });
}