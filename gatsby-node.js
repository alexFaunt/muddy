const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, './.data');

const targetYears = [2016, 2017, 2019, 2022];
const targetYearRegex = new RegExp(`(${targetYears.join('|')})`);
const targetData = ['maxTemp', 'rain', 'cloud'];

exports.createPages = ({ actions }) => {
  const { createPage } = actions

  const dir = fs.readdirSync(DATA_DIR)

  const allFiles = dir.reduce((acc, fileName) => {
    const day = JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf-8'));
    acc.push(day);
    return acc;
  }, []);

  const initialAcc = targetData.reduce((acc, col) => {
    acc[col] = [];
    return acc;
  }, {});

  const data = allFiles
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc, day) => {
      if (!targetYearRegex.test(day.date)) {
        return acc;
      }

      targetData.forEach((col) => {
        acc[col].push({ date: day.date, data: day[col] });
      })

      return acc;
    }, initialAcc);

  createPage({
    path: '/',
    component: require.resolve("./src/templates/index.jsx"),
    context: {
      years: targetYears,
      graphs: targetData,
      data,
    },
  })
}
