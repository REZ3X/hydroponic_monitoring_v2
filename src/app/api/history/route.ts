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
    idleTimeout: 60000,
    timezone: '+00:00'
});

export async function GET(request: Request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'hour';
        
        let timeCondition = '';
        let interval = '';
        let limit = 100;
        
        switch (range) {
            case 'minute':
                interval = '1 MINUTE';
                limit = 60;
                break;
            case 'hour':
                interval = '1 HOUR';
                limit = 60;
                break;
            case 'day':
                interval = '24 HOUR';
                limit = 288;
                break;
            case 'week':
                interval = '7 DAY';
                limit = 336;
                break;
            case 'month':
                interval = '30 DAY';
                limit = 720;
                break;
            default:
                interval = '1 HOUR';
                limit = 60;
        }

        timeCondition = `WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ${interval})`;

        connection = await pool.getConnection();
        console.log('✅ Database connection established');

        const [totalCountResult] = await connection.execute<any[]>(
            'SELECT COUNT(*) as total FROM hydroponic_data'
        );
        const totalCount = totalCountResult[0]?.total || 0;
        console.log('📊 Total rows in database:', totalCount);

        const [recentCountResult] = await connection.execute<any[]>(
            `SELECT COUNT(*) as count FROM hydroponic_data ${timeCondition}`
        );
        const recentCount = recentCountResult[0]?.count || 0;
        console.log(`📈 Rows for ${range} range (${interval}):`, recentCount);

        const [sampleAll] = await connection.execute<any[]>(
            'SELECT id, timestamp, temperature, humidity, water_temp FROM hydroponic_data ORDER BY timestamp DESC LIMIT 5'
        );
        console.log('🕒 Latest 5 records in database:', sampleAll);

        const query = `
            SELECT 
                id, 
                temperature, 
                humidity, 
                water_temp, 
                timestamp 
            FROM hydroponic_data 
            ${timeCondition} 
            ORDER BY timestamp ASC 
            LIMIT ${limit}
        `;
        
        console.log('🔍 Executing query:', query);
        console.log('📋 Parameters:', { range, interval, limit });

        const [results] = await connection.execute<any[]>(query);
        
        console.log('✨ Query results:', {
            isArray: Array.isArray(results),
            length: Array.isArray(results) ? results.length : 'N/A',
            firstItem: Array.isArray(results) && results.length > 0 ? results[0] : null,
            lastItem: Array.isArray(results) && results.length > 0 ? results[results.length - 1] : null
        });

        if (!results || results.length === 0) {
            console.log('⚠️ No data found for range, fetching latest available data...');
            const [fallbackResults] = await connection.execute<any[]>(
                `SELECT id, temperature, humidity, water_temp, timestamp 
                 FROM hydroponic_data 
                 ORDER BY timestamp DESC 
                 LIMIT ${limit}`
            );
            
            console.log('📦 Fallback results:', {
                length: Array.isArray(fallbackResults) ? fallbackResults.length : 'N/A',
                firstItem: Array.isArray(fallbackResults) && fallbackResults.length > 0 ? fallbackResults[0] : null
            });

            connection.release();

            return NextResponse.json(
                Array.isArray(fallbackResults) ? fallbackResults.reverse() : []
            );
        }
        
        connection.release();
        return NextResponse.json(Array.isArray(results) ? results : []);
        
    } catch (error) {
        if (connection) {
            connection.release();
        }
        
        console.error('❌ Error retrieving historical data:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            code: (error as any)?.code,
            errno: (error as any)?.errno,
            sqlState: (error as any)?.sqlState,
            sqlMessage: (error as any)?.sqlMessage,
        });
        
        return NextResponse.json({ 
            error: 'Failed to retrieve historical data',
            details: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code
        }, { status: 500 });
    }
}