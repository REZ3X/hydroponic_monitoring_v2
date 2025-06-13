"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Line } from "react-chartjs-2";
import { addHours, format } from "date-fns";
import { id } from "date-fns/locale/id";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface WeatherEntry {
  id: string;
  temperature: number;
  humidity: number;
  timestamp: string;
  water_temp: number;
  connected?: boolean;
}

const timeRanges: TimeRange[] = [
  { value: "minute", label: "1M", fullLabel: "Last Minute" },
  { value: "hour", label: "1H", fullLabel: "Last Hour" },
  { value: "day", label: "1D", fullLabel: "Last Day" },
  { value: "week", label: "1W", fullLabel: "Last Week" },
  { value: "month", label: "1Mo", fullLabel: "Last Month" },
];

interface TimeRange {
  value: string;
  label: string;
  fullLabel: string;
}

export default function Home() {
  const [monitoringData, setMonitoringData] = useState<WeatherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("minute");
  const [historicalData, setHistoricalData] = useState<WeatherEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'mqtt-connected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [mqttStatus, setMqttStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  const convertToJakartaTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return addHours(date, 7); // UTC+7 for Jakarta
  };

  // MQTT real-time data fetching
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;

    const connectToStream = () => {
      try {
        setConnectionStatus('connecting');
        setMqttStatus('connecting');
        
        eventSource = new EventSource('/api/stream');
        
        // Set a timeout for connection
        connectionTimeout = setTimeout(() => {
          if (connectionStatus === 'connecting') {
            console.log('SSE connection timeout, switching to fallback');
            eventSource?.close();
            startFallbackPolling();
          }
        }, 10000);
        
        eventSource.onopen = () => {
          console.log('SSE connection opened');
          setConnectionStatus('mqtt-connected');
          setMqttStatus('connected');
          if (connectionTimeout) clearTimeout(connectionTimeout);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'connected') {
              console.log('Connected to MQTT stream');
              return;
            }

            if (data.temperature !== null && data.humidity !== null && data.water_temp !== null) {
              const newEntry: WeatherEntry = {
                id: data.id,
                temperature: data.temperature,
                humidity: data.humidity,
                water_temp: data.water_temp,
                timestamp: convertToJakartaTime(data.timestamp).toISOString(),
                connected: true
              };

              setMonitoringData(prev => {
                const updated = [...prev, newEntry];
                return updated.slice(-50);
              });
              
              setLastUpdate(new Date());
              setConnectionStatus('mqtt-connected');
              setMqttStatus('connected');
              setLoading(false);
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          setConnectionStatus('disconnected');
          setMqttStatus('disconnected');
          
          eventSource?.close();
          
          // Don't immediately reconnect, wait a bit
          setTimeout(() => {
            if (connectionStatus === 'disconnected') {
              startFallbackPolling();
            }
          }, 5000);
        };

      } catch (error) {
        console.error('Failed to connect to SSE:', error);
        setConnectionStatus('disconnected');
        setMqttStatus('disconnected');
        startFallbackPolling();
      }
    };

    // Fallback polling
    const startFallbackPolling = () => {
      setConnectionStatus('connected'); // Regular HTTP polling
      setMqttStatus('disconnected');
      
      fallbackInterval = setInterval(async () => {
        try {
          const response = await fetch("/api/realtime");
          const data = await response.json();
          
          if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            const newEntry: WeatherEntry = {
              ...entry,
              timestamp: convertToJakartaTime(entry.timestamp).toISOString(),
            };

            setMonitoringData(prev => {
              const updated = [...prev, newEntry];
              return updated.slice(-50);
            });
            
            setConnectionStatus('connected');
            setLastUpdate(new Date());
            setLoading(false);
          }
        } catch (error) {
          console.error("Failed to fetch fallback data:", error);
          setConnectionStatus('disconnected');
        }
      }, 3000); // Poll every 3 seconds
    };

    // Start with SSE
    connectToStream();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
    };
  }, []);

  // Historical data fetching (unchanged)
 useEffect(() => {
  async function fetchHistoricalData() {
    try {
      console.log(`Fetching historical data for range: ${selectedTimeRange}`);
      const response = await fetch(`/api/history?range=${selectedTimeRange}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Raw historical data response:', data);
      console.log('Is array?', Array.isArray(data));
      console.log('Length:', Array.isArray(data) ? data.length : 'N/A');
      
      if (Array.isArray(data)) {
        const processedData = data.map((entry: WeatherEntry) => ({
          ...entry,
          timestamp: convertToJakartaTime(entry.timestamp).toISOString(),
        }));
        
        console.log('Processed historical data:', processedData.slice(0, 3)); // Show first 3 entries
        setHistoricalData(processedData);
      } else {
        console.error("Historical data is not an array:", data);
        setHistoricalData([]);
      }
    } catch (error) {
      console.error("Failed to fetch historical data:", error);
      setHistoricalData([]);
    }
  }

  fetchHistoricalData();
}, [selectedTimeRange]);

  // Rest of your component methods remain the same...
  const getWaterTempColor = (temp: number) => {
    if (temp > 30) return "from-rose-400 to-red-500";
    if (temp < 20) return "from-sky-400 to-blue-500";
    return "from-teal-400 to-emerald-500";
  };
  
  const getTemperatureColor = (temp: number) => {
    if (temp > 30) return "from-amber-400 to-orange-500";
    if (temp < 20) return "from-blue-400 to-cyan-500";
    return "from-green-400 to-emerald-500";
  };
  
  const getHumidityColor = (humidity: number) => {
    if (humidity > 80) return "from-indigo-400 to-blue-500";
    if (humidity < 40) return "from-yellow-400 to-amber-500";
    return "from-emerald-400 to-teal-500";
  };

  const getStatusColor = (type: string, value: number) => {
    switch (type) {
      case 'temperature':
        if (value > 35 || value < 15) return 'text-red-500';
        if (value > 30 || value < 18) return 'text-yellow-500';
        return 'text-green-500';
      case 'humidity':
        if (value > 85 || value < 35) return 'text-red-500';
        if (value > 80 || value < 40) return 'text-yellow-500';
        return 'text-green-500';
      case 'waterTemp':
        if (value > 30 || value < 18) return 'text-red-500';
        if (value > 28 || value < 20) return 'text-yellow-500';
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getTimeFormat = (range: string) => {
    switch (range) {
      case "minute":
        return "HH:mm:ss";
      case "hour":
        return "HH:mm";
      case "day":
        return "HH:mm";
      case "week":
        return "MM/dd HH:mm";
      case "month":
        return "MM/dd";
      default:
        return "HH:mm:ss";
    }
  };

  const getChartOptions = (dataSource: WeatherEntry[], timeRange: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (context: TooltipItem<"line">[]) => {
            const index = context[0].dataIndex;
            const timestamp = dataSource[index]?.timestamp;
            if (!timestamp) return "";
            return format(
              new Date(timestamp),
              timeRange === "minute" ? "HH:mm:ss" : "yyyy-MM-dd HH:mm:ss",
              { locale: id }
            );
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          maxTicksLimit: 8,
          color: 'rgba(0, 0, 0, 0.7)',
          callback: function (value: number | string, index: number) {
            const entry = dataSource[index];
            if (!entry?.timestamp) return "";
            return format(new Date(entry.timestamp), getTimeFormat(timeRange), {
              locale: id,
            });
          },
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: 'rgba(0, 0, 0, 0.7)',
        },
      },
    },
  });

  const createChartData = (
    data: WeatherEntry[],
    key: keyof WeatherEntry,
    label: string,
    color: string,
    isRealTime: boolean = false
  ) => {
    const displayData = isRealTime ? data.slice(-10) : data;
    return {
      labels:
        displayData?.map((d) =>
          d?.timestamp
            ? format(new Date(d.timestamp), "HH:mm:ss", { locale: id })
            : ""
        ) || [],
      datasets: [
        {
          label,
          data: displayData?.map((d) => Number(d[key])) || [],
          borderColor: color,
          backgroundColor: `${color}20`,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  };

  const ConnectionIndicator = () => (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'mqtt-connected' ? 'bg-green-500 animate-pulse' : 
          connectionStatus === 'connected' ? 'bg-blue-500 animate-pulse' :
          connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
          'bg-red-500'
        }`} />
        <span className={`font-medium ${
          connectionStatus === 'mqtt-connected' ? 'text-green-700' : 
          connectionStatus === 'connected' ? 'text-blue-700' :
          connectionStatus === 'connecting' ? 'text-yellow-700' : 
          'text-red-700'
        }`}>
          {connectionStatus === 'mqtt-connected' ? '🚀 MQTT Live' : 
           connectionStatus === 'connected' ? '📡 Connected' :
           connectionStatus === 'connecting' ? '🔄 Connecting...' : 
           '❌ Disconnected'}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          mqttStatus === 'connected' ? 'bg-purple-500 animate-pulse' : 
          mqttStatus === 'connecting' ? 'bg-orange-500 animate-pulse' : 
          'bg-gray-500'
        }`} />
        <span className={`font-medium text-xs ${
          mqttStatus === 'connected' ? 'text-purple-600' : 
          mqttStatus === 'connecting' ? 'text-orange-600' : 
          'text-gray-600'
        }`}>
          MQTT: {mqttStatus === 'connected' ? 'Active' : 
                 mqttStatus === 'connecting' ? 'Connecting' : 
                 'Inactive'}
        </span>
      </div>
      
      {lastUpdate && connectionStatus !== 'disconnected' && (
        <span className="text-gray-500 text-xs">
          Last update: {format(lastUpdate, 'HH:mm:ss')}
        </span>
      )}
    </div>
  );

  // Rest of your JSX remains the same, just update the data fetching calls
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            🌱 Hydroponic Monitoring System
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-medium mb-4">
            Real-time Plant Environment Dashboard via MQTT
          </p>
          <ConnectionIndicator />
        </div>

        {/* Real-time Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-8">
          {loading
            ? Array(3)
                .fill(null)
                .map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-6">
                      <Skeleton className="h-[320px] w-full rounded-lg" />
                    </CardContent>
                  </Card>
                ))
            : monitoringData.length > 0 && (
                <>
                  {/* Air Temperature Card */}
                  <Card className="bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-gray-200/50 overflow-hidden group">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-lg font-semibold text-slate-700 flex items-center justify-center gap-2">
                        🌡️ Air Temperature
                        {connectionStatus === 'mqtt-connected' && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">LIVE</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-gradient-to-br ${getTemperatureColor(
                            monitoringData[monitoringData.length - 1].temperature
                          )} flex items-center justify-center text-white mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300`}
                        >
                          <div className="text-center">
                            <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">
                              {monitoringData[monitoringData.length - 1].temperature.toFixed(1)}
                            </span>
                            <span className="text-xs sm:text-sm opacity-90">°C</span>
                          </div>
                        </div>
                        <div className={`text-sm font-semibold mb-3 ${getStatusColor('temperature', monitoringData[monitoringData.length - 1].temperature)}`}>
                          {monitoringData[monitoringData.length - 1].temperature > 35 || monitoringData[monitoringData.length - 1].temperature < 15 ? '⚠️ Critical' :
                           monitoringData[monitoringData.length - 1].temperature > 30 || monitoringData[monitoringData.length - 1].temperature < 18 ? '⚡ Warning' :
                           '✅ Optimal'}
                        </div>
                        <div className="w-full h-[140px] sm:h-[160px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "temperature",
                              "Temperature",
                              "#f97316",
                              true
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Humidity Card */}
                  <Card className="bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-gray-200/50 overflow-hidden group">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-lg font-semibold text-slate-700 flex items-center justify-center gap-2">
                        💧 Humidity
                        {connectionStatus === 'mqtt-connected' && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">LIVE</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-gradient-to-br ${getHumidityColor(
                            monitoringData[monitoringData.length - 1].humidity
                          )} flex items-center justify-center text-white mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300`}
                        >
                          <div className="text-center">
                            <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">
                              {monitoringData[monitoringData.length - 1].humidity.toFixed(0)}
                            </span>
                            <span className="text-xs sm:text-sm opacity-90">%</span>
                          </div>
                        </div>
                        <div className={`text-sm font-semibold mb-3 ${getStatusColor('humidity', monitoringData[monitoringData.length - 1].humidity)}`}>
                          {monitoringData[monitoringData.length - 1].humidity > 85 || monitoringData[monitoringData.length - 1].humidity < 35 ? '⚠️ Critical' :
                           monitoringData[monitoringData.length - 1].humidity > 80 || monitoringData[monitoringData.length - 1].humidity < 40 ? '⚡ Warning' :
                           '✅ Optimal'}
                        </div>
                        <div className="w-full h-[140px] sm:h-[160px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "humidity",
                              "Humidity",
                              "#3b82f6",
                              true
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Water Temperature Card */}
                  <Card className="bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300 border-0 ring-1 ring-gray-200/50 overflow-hidden group sm:col-span-2 xl:col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-lg font-semibold text-slate-700 flex items-center justify-center gap-2">
                        🌊 Water Temperature
                        {connectionStatus === 'mqtt-connected' && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">LIVE</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-gradient-to-br ${getWaterTempColor(
                            monitoringData[monitoringData.length - 1].water_temp
                          )} flex items-center justify-center text-white mb-4 shadow-xl group-hover:scale-105 transition-transform duration-300`}
                        >
                          <div className="text-center">
                            <span className="text-xl sm:text-2xl lg:text-3xl font-bold block">
                              {monitoringData[monitoringData.length - 1].water_temp.toFixed(1)}
                            </span>
                            <span className="text-xs sm:text-sm opacity-90">°C</span>
                          </div>
                        </div>
                        <div className={`text-sm font-semibold mb-3 ${getStatusColor('waterTemp', monitoringData[monitoringData.length - 1].water_temp)}`}>
                          {monitoringData[monitoringData.length - 1].water_temp > 30 || monitoringData[monitoringData.length - 1].water_temp < 18 ? '⚠️ Critical' :
                           monitoringData[monitoringData.length - 1].water_temp > 28 || monitoringData[monitoringData.length - 1].water_temp < 20 ? '⚡ Warning' :
                           '✅ Optimal'}
                        </div>
                        <div className="w-full h-[140px] sm:h-[160px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "water_temp",
                              "Water Temperature",
                              "#10b981",
                              true
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
        </div>

        {/* Historical Data Section - Keep as is */}
        <Card className="bg-white/95 backdrop-blur-sm border-0 ring-1 ring-gray-200/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/50">
            <CardTitle className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              📊 Historical Data Analytics
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">Track your hydroponic system performance over time</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Time Range Selector */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setSelectedTimeRange(range.value)}
                  className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-all font-semibold text-sm sm:text-base min-w-[60px] ${
                    selectedTimeRange === range.value
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-102"
                  }`}
                  title={range.fullLabel}
                >
                  <span className="block sm:hidden">{range.label}</span>
                  <span className="hidden sm:block">{range.fullLabel}</span>
                </button>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="space-y-8">
              {/* Temperature History */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 sm:p-6 border border-orange-200/50">
                <h3 className="text-lg sm:text-xl font-semibold text-orange-800 mb-4 flex items-center gap-2">
                  🌡️ Temperature History
                  <span className="text-sm font-normal text-orange-600">
                    ({timeRanges.find(r => r.value === selectedTimeRange)?.fullLabel})
                  </span>
                </h3>
                <div className="h-[250px] sm:h-[300px]">
                  <Line
                    options={getChartOptions(historicalData, selectedTimeRange)}
                    data={createChartData(
                      historicalData,
                      "temperature",
                      "Temperature",
                      "rgb(251, 146, 60)"
                    )}
                  />
                </div>
              </div>

              {/* Humidity History */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-200/50">
                <h3 className="text-lg sm:text-xl font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  💧 Humidity History
                  <span className="text-sm font-normal text-blue-600">
                    ({timeRanges.find(r => r.value === selectedTimeRange)?.fullLabel})
                  </span>
                </h3>
                <div className="h-[250px] sm:h-[300px]">
                  <Line
                    options={getChartOptions(historicalData, selectedTimeRange)}
                    data={createChartData(
                      historicalData,
                      "humidity",
                      "Humidity",
                      "rgb(59, 130, 246)"
                    )}
                  />
                </div>
              </div>

              {/* Water Temperature History */}
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 sm:p-6 border border-teal-200/50">
                <h3 className="text-lg sm:text-xl font-semibold text-teal-800 mb-4 flex items-center gap-2">
                  🌊 Water Temperature History
                  <span className="text-sm font-normal text-teal-600">
                    ({timeRanges.find(r => r.value === selectedTimeRange)?.fullLabel})
                  </span>
                </h3>
                <div className="h-[250px] sm:h-[300px]">
                  <Line
                    options={getChartOptions(historicalData, selectedTimeRange)}
                    data={createChartData(
                      historicalData,
                      "water_temp",
                      "Water Temperature",
                      "rgb(20, 184, 166)"
                    )}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>🌱 Hydroponic Monitoring System • Real-time Environmental Tracking via MQTT</p>
        </div>
      </div>
    </div>
  );
}