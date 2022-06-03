import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
const monthConfig = require('../month-config');

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const options = ({ title, max }) => ({
  responsive: true,
  plugins: {
    legend: {
      position: 'right',
    },
    title: {
      display: true,
      text: title,
    },
  },
  scales: {
    yAxis: {
      min: 0,
      ...(max ?  { max } : null),
    }
  },
});

const reduceGraphData = (acc, entry) => {
  const year = entry.date.replace(/-\d{2}-\d{2}$/, '');

  acc[year] = acc[year] || [];

  acc[year].push(entry.data.value);

  return acc;
};

const rgba = (hex, a1, a2 = a1) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);

  return {
    borderColor: `rgba(${r}, ${g}, ${b}, ${a1})`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${a2})`,
  };
};

const colorPool = {
  2016: rgba('#6f0909', 0.4), // brown
  2017: rgba('#007500', 0.4), // green
  2019: rgba('#ffa500', 0.4), // orange
  2022: rgba('#387dff', 1, 0.8), // blue
};

const Home = ({ pageContext }) => {
  const { data } = pageContext;

  const labels = Array.from(
    new Set(
      data.maxTemp.map(({ date }) => date.replace(/^\d{4}-/, ''))
    )
  ).map((str) => {
    const [month, day] = str.split('-');
    return `${day} ${monthConfig[month].name}`;
  });

  // TODO years, with clicky buttons, set `hidden: true` on the datasets

  const rainByYear = data.rain.reduce(reduceGraphData, {});

  const rainGraphData = {
    labels,
    datasets: Object.entries(rainByYear).map(([year, vals]) => ({
      label: year,
      data: vals,
      pointRadius: 1,
      tension: 0.3,
      ...colorPool[year],
    })),
  };

  const maxTempByYear = data.maxTemp.reduce(reduceGraphData, {});

  const maxTempGraphData = {
    labels,
    datasets: Object.entries(maxTempByYear).map(([year, vals], i) => ({
      label: year,
      data: vals,
      tension: 0.3,
      pointRadius: 1,
      ...colorPool[year],
    })),
  };

  const cloudByYear = data.cloud.reduce(reduceGraphData, {});

  const cloudGraphData = {
    labels,
    datasets: Object.entries(cloudByYear).map(([year, vals], i) => ({
      label: year,
      data: vals,
      tension: 0.3,
      pointRadius: 1,
      ...colorPool[year],
    })),
  };

  return (
    <div>
      <h2 style={{ textAlign: 'center', fontFamily: 'arial', marginBottom: '3rem' }}>Muddy?</h2>
      <Line options={options({ title: 'Daily Rainfall' })} data={rainGraphData} />
      <div style={{ marginBottom: '3rem' }} />
      <Line options={options({ title: 'Max Daily Temp' })} data={maxTempGraphData} />
      <div style={{ marginBottom: '3rem' }} />
      <Line options={options({ title: 'Cloud cover', max: 100 })} data={cloudGraphData} />
    </div>
  )
}
export default Home;
