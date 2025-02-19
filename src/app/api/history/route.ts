import mysql from 'mysql2';
import { NextResponse } from 'next/server';

const db = mysql.createConnection({
    host: process.env.NEXT_PUBLIC_DB_HOST,
    user: process.env.NEXT_PUBLIC_DB_USER,
    password: process.env.NEXT_PUBLIC_DB_PASSWORD,
    database: process.env.NEXT_PUBLIC_DB_NAME,
    port: process.env.NEXT_PUBLIC_DB_PORT ? parseInt(process.env.NEXT_PUBLIC_DB_PORT) : undefined,
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

  return new Promise((resolve) => {
    const query = `
      SELECT * FROM hydroponic_data 
      WHERE timestamp >= NOW() - ${timeFilter}
      ORDER BY timestamp ASC
      LIMIT 100
    `

    db.query(query, (err, results) => {
      if (err) {
        console.error('Database error:', err)
        resolve(NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 }))
      } else {
        resolve(NextResponse.json(results))
      }
    })
  })
}