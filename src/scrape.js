const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const monthConfig = require('./month-config');

const CACHE_DIR = path.resolve(__dirname, '../.data');
const SCRAPE_PAGE = 'https://www.worldweatheronline.com/yeovilton-weather-history/somerset/gb.aspx';

const numToDate = (num) => num.toString().padStart(2, '0');
const getCachePath = ({ year, day, month }) => path.join(CACHE_DIR, `${year}-${numToDate(month)}-${numToDate(day)}.json`)

const setDataCache = (data) => {
  try {
    fs.mkdirSync(CACHE_DIR);
  } catch (e) {
  }

  fs.writeFileSync(
    path.join(CACHE_DIR, `${data.date}.json`),
    JSON.stringify(data, null, 2),
    'utf-8',
  );
}

let browserCache;
const getBrowser = async () => {
  if (!browserCache) {
    browserCache = await puppeteer.launch();
  }

  return browserCache;
}

const getAllYears = async ({ day, month }) => {
  const browser = await getBrowser();

  const page = await browser.newPage();

  await page.goto(SCRAPE_PAGE);

  try {
    await page.waitForSelector('input[type="date"]');
  } catch (error) {
    throw new Error(`timeout waiting for input[type="date"] - ${monthConfig[month].name} ${day}`)
  }

  await page.evaluate(({ day, month }) => {
    const numToDate = (num) => num.toString().padStart(2, '0');

    // Set the value
    document.querySelector('input[type="date"]').value = `2021-${numToDate(month)}-${numToDate(day)}`

    // Submit the page
    document.querySelector('input[value="Get Weather"]').click();
  }, { day, month });

  // TODO timeout
  const table = await new Promise((resolve) => {
    // ... wait for the page to reset
    const poll = async () => {
      await page.waitForSelector('h2.block_title');

      const tableTitle = await page.evaluate(() => {
        return document.querySelector('h2.block_title').textContent
      });

      if (!tableTitle) {
        throw new Error('No table title found');
      }

      const [, date, , monthStr] = tableTitle.match(/(\d{2})(st|nd|rd|th)\s([^\s]*)/) || [];

      if (date !== numToDate(day) || monthStr !== monthConfig[month].name) {
        // TODO max poll + reject
        setTimeout(poll, 1000);
        return;
      }

      let data;
      try {
        data = await page.evaluate(({ month, day }) => {
          const numToDate = (num) => num.toString().padStart(2, '0');

          const cells = Array.from(
            document.querySelectorAll('.wwo-tabular .col:not(.text-white)')
          ).map((cell) => cell.innerHTML);

          const cols = Array.from(
            document.querySelectorAll('.wwo-tabular .col.text-white')
          ).map((cell) => cell.textContent.toLowerCase());

          const parsePct = (str) => {
            const match = str.match(/^([\d\.]*)\%$/);
            if (!match) {
              throw new Error(`error parsing pct: ${str}`)
            }
            return {
              value: parseInt(match[1], 10),
              units: '%',
            };
          }

          const parseTemp = (str) => {
            const match = str.match(/^-?(\d*)\s°c$/);
            if (!match) {
              throw new Error(`error parsing temp: ${str}`)
            }
            return {
              value: parseFloat(match[1]),
              units: 'c',
            };
          }

          const parseWeather = (str) => {
            const [, title] = str.match(/title=\"([^\\]*)\"/) || [null, null];
            if (!title) {
              throw new Error(`Failed to parse weather: ${str}`);
            }
            return title;
          }

          const parseWind = (str) => {
            const match = str.match(/^(\d*)\s(km\/h)\<br\>(\w*)$/);
            if (!match) {
              throw new Error(`error parsing wind: ${str}`)
            }
            const [, value, units, direction] = match;
            return { value: parseInt(value, 10), units, direction };
          }

          const parseRain = (str) => {
            const match = str.match(/^([\d\.]*)\smm$/);
            if (!match) {
              throw new Error(`error parsing rain: ${str}`)
            }
            return { value: parseFloat(match[1]), units: 'mm' };
          }

          const parsePressure = (str) => {
            const match = str.match(/^([\d\.]*)\smb$/);
            if (!match) {
              throw new Error(`error parsing pressure: ${str}`)
            }
            return { value: parseInt(match[1], 10), units: 'mb' };
          }

          const colCount = cols.length;

          const rows = [];
          for (let index = 0; index < cells.length; index += colCount) {
            const row = cells.slice(index, index + colCount);

            rows.push(
              cols.reduce((acc, col, colIndex) => {
                const rawVal = row[colIndex];

                const val = (() => {
                  switch(col) {
                    case 'year':
                      return parseInt(rawVal, 10);
                    case 'weather':
                      return parseWeather(rawVal);
                    case 'max':
                      return parseTemp(rawVal);
                    case 'min':
                      return parseTemp(rawVal);
                    case 'wind':
                      return parseWind(rawVal);
                    case 'rain':
                      return parseRain(rawVal);
                    case 'humidity':
                      return parsePct(rawVal);
                    case 'cloud':
                      return parsePct(rawVal);
                    case 'pressure':
                      return parsePressure(rawVal);
                    default:
                      throw new Error('unknown column');
                  }
                })()

                if (col === 'year') {
                  acc.date = `${val}-${numToDate(month)}-${numToDate(day)}`
                } else if (col === 'min') {
                  acc.minTemp = val;
                } else if (col === 'max') {
                  acc.maxTemp = val;
                } else {
                  acc[col] = val;
                }

                return acc;
              }, {})
            )
          }

          return rows;
        }, { month, day })
      } catch (error) {
        await page.close();
        throw new Error(`ERROR [${month}-${day}] >> ${error.message}`);
      }

      await page.close();
      console.log('SUCCESS', monthConfig[month].name, numToDate(day))

      resolve(data);
    }

    poll();
  });

  return table;
}

const robustGetAllYears = async (args, count = 3) => {
  try {
    const res = await getAllYears(args);
    return res;
  } catch (error) {
    if (count > 0) {
      console.log('RETRY', monthConfig[args.month].name, numToDate(args.day));
      return robustGetAllYears(args, count - 1);
    }

    throw new Error(`failed retries >> ${error.message}`);
  }
}

const downloadData = async ({ day, month }) => {
  const data = await robustGetAllYears({ day, month });

  data.forEach((entry) => {
    setDataCache(entry);
  });
};

const run = async () => {
  const browser = await getBrowser();

  const months = [5, 6];

  const dates = months.reduce((acc, month) => {
    const days = Array.from({ length: monthConfig[month].days }).map((_, i) => i + 1);
    return acc.concat(days.map((day) => ({ day, month })))
  }, []);

  await Promise.all(dates.map(downloadData));

  await browser.close();
}
run();
