import mysql from 'mysql2';

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
    console.log('Connected to database');
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handles POST requests to insert temperature and humidity data into the database.
 *
 * @param {Request} req - The incoming request object.
 * @returns {Promise<Response>} - A promise that resolves to a Response object.
 *
 * @throws {Error} - Throws an error if there is an issue with the database query.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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

    return new Promise((resolve) => {
      db.query(
        'INSERT INTO hydroponic_data (temperature, humidity, water_temp) VALUES (?, ?, ?)',
        [temperatureDHT, humidity, temperatureDS18B20],
        (err) => {
          if (err) {
            console.error('Error inserting data:', err);
            resolve(
              NextResponse.json(
                { error: 'Error inserting data' },
                { status: 500, headers: corsHeaders }
              )
            );
          } else {
            resolve(
              NextResponse.json(
                { 
                  message: 'Data inserted successfully',
                  data: { temperatureDHT, humidity, temperatureDS18B20 }
                },
                { status: 200, headers: corsHeaders }
              )
            );
          }
        }
      );
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}