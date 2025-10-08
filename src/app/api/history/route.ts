import mysql from 'mysql2/promise';
import { NextResponse } from 'next/server';

const pool = mysql.createPool({
    host: process.env.DB_HOST || process.env.NEXT_PUBLIC_DB_HOST,
    user: process.env.DB_USER || process.env.NEXT_PUBLIC_DB_USER,
    password: process.env.DB_PASSWORD || process.env.NEXT_PUBLIC_DB_PASSWORD,
    database: process.env.DB_NAME || process.env.NEXT_PUBLIC_DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (process.env.NEXT_PUBLIC_DB_PORT ? parseInt(process.env.NEXT_PUBLIC_DB_PORT) : 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    idleTimeout: 60000
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'hour';
        
        let timeCondition = '';
        let limit = 100;
        
        switch (range) {
            case 'minute':
                timeCondition = 'WHERE timestamp >= NOW() - INTERVAL 1 MINUTE';
                limit = 60;
                break;
            case 'hour':
                timeCondition = 'WHERE timestamp >= NOW() - INTERVAL 1 HOUR';
                limit = 60;
                break;
            case 'day':
                timeCondition = 'WHERE timestamp >= NOW() - INTERVAL 1 DAY';
                limit = 144;
                break;
            case 'week':
                timeCondition = 'WHERE timestamp >= NOW() - INTERVAL 1 WEEK';
                limit = 168;
                break;
            case 'month':
                timeCondition = 'WHERE timestamp >= NOW() - INTERVAL 1 MONTH';
                limit = 720;
                break;
            default:
                timeCondition = 'WHERE timestamp >= NOW() - INTERVAL 1 HOUR';
        }

        const connection = await pool.getConnection();
        console.log('✅ Database connection established');

        const [totalCount] = await connection.execute('SELECT COUNT(*) as total FROM hydroponic_data');
        console.log('📊 Total rows in database:', totalCount);

        const [recentCount] = await connection.execute(
            `SELECT COUNT(*) as count FROM hydroponic_data ${timeCondition}`
        );
        console.log(`📈 Rows for ${range} range:`, recentCount);

        const [sampleAll] = await connection.execute(
            'SELECT timestamp FROM hydroponic_data ORDER BY timestamp DESC LIMIT 5'
        );
        console.log('🕒 Latest timestamps in database:', sampleAll);

        const query = `SELECT id, temperature, humidity, water_temp, timestamp 
                       FROM hydroponic_data 
                       ${timeCondition} 
                       ORDER BY timestamp ASC 
                       LIMIT ${limit}`;
        
        console.log('🔍 Executing query:', query);
        console.log('📋 Parameters:', { range, limit });

        const [results] = await connection.execute(query);
        connection.release();
        
        console.log('✨ Query results:', {
            isArray: Array.isArray(results),
            length: Array.isArray(results) ? results.length : 'N/A',
            firstItem: Array.isArray(results) && results.length > 0 ? results[0] : null,
            lastItem: Array.isArray(results) && results.length > 0 ? results[results.length - 1] : null
        });
        
        return NextResponse.json(Array.isArray(results) ? results : []);
    } catch (error) {
        console.error('❌ Error retrieving historical data:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            code: (error as any)?.code,
            errno: (error as any)?.errno,
            sqlState: (error as any)?.sqlState,
        });
        
        return NextResponse.json({ 
            error: 'Failed to retrieve historical data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}