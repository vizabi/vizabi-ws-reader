import isArray from 'lodash/isArray';

function mapRows(original, formatters = {}) {
  return original.map(row => {
    Object.keys(row).forEach(column => {
      row[column] = mapRow(row[column], formatters[column]);
    });

    return row;
  });
}

function mapRow(value, fmt = parseByDefault) {
  if (!isArray(value)) {
    return fmt(value);
  }
  return value.map(current => mapRow(current, fmt));
}

function parseByDefault(value) {
  if (value === '' || value === null) {
    return null;
  }
  if (!value.trim) {
    return value;
  }
  if (value.trim().match(/^[0-9.,]+$/) == null) {
    return value;
  }

  const parsedValue = parseFloat(value);

  return isNaN(parsedValue) || !isFinite(parsedValue) ? value : parsedValue;
}

export { mapRows };
