import mysql from 'mysql2/promise';
import { NextResponse } from 'next/server';

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
    idleTimeout: 60000
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || 'minute'
  
  let timeFilter: string
  switch(range) {
    case 'minute':
      timeFilter = 'INTERVAL 1 MINUTE'
      break
    case 'hour':
      timeFilter = 'INTERVAL 1 HOUR'
      break
    case 'day':
      timeFilter = 'INTERVAL 1 DAY'
      break
    case 'week':
      timeFilter = 'INTERVAL 1 WEEK'
      break
    case 'month':
      timeFilter = 'INTERVAL 1 MONTH'
      break
    default:
      timeFilter = 'INTERVAL 1 MINUTE'
  }

  try {
    const query = `
      SELECT * FROM hydroponic_data 
      WHERE timestamp >= NOW() - ${timeFilter}
      ORDER BY timestamp ASC
      LIMIT 100
    `

    const [results] = await pool.execute(query)
    return NextResponse.json(results)
  } catch (err) {
    console.error('Database error:', err)
    return NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 })
  }
}