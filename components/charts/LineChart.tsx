import React, { useEffect, useRef } from 'react';

// Allow global Chart var from CDN
declare var Chart: any;

interface ChartProps {
  data: any;
  options?: any;
}

const LineChart: React.FC<ChartProps> = ({ data, options }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const defaultOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top' as const,
          },
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
      };

      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data,
        options: options || defaultOptions,
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, options]);

  return <canvas ref={chartRef}></canvas>;
};

export default LineChart;
