"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
}

const timeRanges: TimeRange[] = [
  { value: "minute", label: "Last Minute" },
  { value: "hour", label: "Last Hour" },
  { value: "day", label: "Last Day" },
  { value: "week", label: "Last Week" },
  { value: "month", label: "Last Month" },
];

interface TimeRange {
  value: string;
  label: string;
}

export default function Home() {
  const [monitoringData, setMonitoringData] = useState<WeatherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("minute");
  const [historicalData, setHistoricalData] = useState<WeatherEntry[]>([]);

  const convertToJakartaTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return addHours(date, 7); // UTC+7 for Jakarta
  };

  useEffect(() => {
    async function fetchWeatherData() {
      try {
        const response = await fetch("/api/data");
        const data = await response.json();
        // Check if data is an array before mapping
        if (Array.isArray(data)) {
          setMonitoringData(
            data.map((entry: WeatherEntry) => ({
              ...entry,
              timestamp: convertToJakartaTime(entry.timestamp).toISOString(),
            }))
          );
        } else {
          console.error("Data is not an array:", data);
          setMonitoringData([]); // Set empty array as fallback
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setMonitoringData([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    }

    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        const response = await fetch(`/api/history?range=${selectedTimeRange}`);
        if (!response.ok) {
          throw new Error("Failed to fetch historical data");
        }
        const data = await response.json();
        // Check if data is an array before mapping
        if (Array.isArray(data)) {
          setHistoricalData(
            data.map((entry: WeatherEntry) => ({
              ...entry,
              timestamp: convertToJakartaTime(entry.timestamp).toISOString(),
            }))
          );
        } else {
          console.error("Historical data is not an array:", data);
          setHistoricalData([]); // Set empty array as fallback
        }
      } catch (error) {
        console.error("Failed to fetch historical data:", error);
        setHistoricalData([]); // Set empty array on error
      }
    }

    fetchHistoricalData();
  }, [selectedTimeRange]);

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
        ticks: {
          maxTicksLimit: 8,
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
          backgroundColor: color,
          tension: 0.4,
        },
      ],
    };
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-800 mb-8 text-center">
          Hydroponic Monitoring System
          <span className="block text-base sm:text-lg text-slate-600 mt-2 font-semibold">
            Real-time Dashboard
          </span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading
            ? Array(3)
                .fill(null)
                .map((_, i) => (
                  <Skeleton key={i} className="h-[300px] rounded-xl" />
                ))
            : monitoringData[0] && (
                <>
                  {/* Air Temperature Card */}
                  <Card className="bg-white/95 backdrop-blur-sm hover:shadow-lg transition-all duration-300 border-none ring-1 ring-gray-100">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-32 h-32 rounded-full bg-gradient-to-br ${getTemperatureColor(
                            monitoringData[monitoringData.length - 1]
                              .temperature
                          )} 
  flex items-center justify-center text-white mb-4 shadow-lg`}
                        >
                          <span className="text-4xl font-bold">
                            {
                              monitoringData[monitoringData.length - 1]
                                .temperature
                            }
                            °C
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-blue-800 mb-4">
                          Air Temperature
                        </h3>
                        <div className="w-full h-[150px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "temperature",
                              "Temperature",
                              "#f97316",
                              true // Add this parameter for real-time data
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Humidity Card */}
                  <Card className="bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-32 h-32 rounded-full bg-gradient-to-br ${getHumidityColor(
                            monitoringData[monitoringData.length - 1].humidity
                          )} 
  flex items-center justify-center text-white mb-4 shadow-lg`}
                        >
                          <span className="text-4xl font-bold">
                            {monitoringData[monitoringData.length - 1].humidity}
                            %
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-blue-800 mb-4">
                          Humidity
                        </h3>
                        <div className="w-full h-[150px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "humidity",
                              "Humidity",
                              "#3b82f6",
                              true // Add this parameter for real-time data
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Water Temperature Card */}
                  <Card className="bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-32 h-32 rounded-full bg-gradient-to-br ${getWaterTempColor(
                            monitoringData[monitoringData.length - 1].water_temp
                          )} 
  flex items-center justify-center text-white mb-4 shadow-lg`}
                        >
                          <span className="text-4xl font-bold">
                            {
                              monitoringData[monitoringData.length - 1]
                                .water_temp
                            }
                            °C
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-blue-800 mb-4">
                          Water Temperature
                        </h3>
                        <div className="w-full h-[150px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "water_temp",
                              "Water Temperature",
                              "#10b981",
                              true // Add this parameter for real-time data
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
        </div>
        <div className="mt-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg p-6 mb-6 ring-1 ring-gray-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Historical Data
          </h2>
          <div className="flex gap-3 mb-6">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setSelectedTimeRange(range.value)}
                className={`px-4 py-2 rounded-lg transition-all font-semibold ${
                  selectedTimeRange === range.value
                    ? "bg-indigo-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="h-[300px]">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  Temperature History
                </h3>
                <Line
            options={getChartOptions(historicalData, selectedTimeRange)}
            data={createChartData(
              historicalData,
              "temperature",
              "Temperature",
              "rgb(251, 146, 60)" // Warm orange
            )}
          />
              </div>

              <div className="h-[300px] mt-8">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  Humidity History
                </h3>
                <Line
            data={createChartData(
              historicalData,
              "humidity",
              "Humidity",
              "rgb(59, 130, 246)" // Royal blue
            )}
          />
              </div>

              <div className="h-[300px] mt-8">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  Water Temperature History
                </h3>
                <Line
            data={createChartData(
              historicalData,
              "water_temp",
              "Water Temperature",
              "rgb(20, 184, 166)" // Teal
            )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
