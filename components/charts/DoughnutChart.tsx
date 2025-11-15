import React, { useEffect, useRef } from 'react';

// Allow global Chart var from CDN
declare var Chart: any;

interface ChartProps {
  data: any;
  options?: any;
  onClick?: (label: string) => void;
}

const DoughnutChart: React.FC<ChartProps> = ({ data, options, onClick }) => {
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
            display: true,
            position: 'right' as const,
          },
        },
        onClick: (event: any, elements: any) => {
          if (onClick && elements.length > 0) {
            const chartElement = elements[0];
            const label = chartInstance.current.data.labels[chartElement.index];
            onClick(label);
          }
        },
        onHover: (event: any, chartElement: any) => {
          if (chartElement.length > 0) {
            event.native.target.style.cursor = 'pointer';
          } else {
            event.native.target.style.cursor = 'default';
          }
        },
      };

      chartInstance.current = new Chart(chartRef.current, {
        type: 'doughnut',
        data,
        options: options || defaultOptions,
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, options, onClick]);

  return <canvas ref={chartRef}></canvas>;
};

export default DoughnutChart;