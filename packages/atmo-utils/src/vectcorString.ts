import { Vector3 } from 'three';

const kmFormatter = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 1,
  style: 'unit',
  unit: 'kilometer',
});

const mFormatter = Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  style: 'unit',
  unit: 'meter',
});

export function vectorString(v: Vector3, unit = 'm', mag = false) {
  if (!(v instanceof Vector3)) {
    return '--- non vector';
  }
  let base = unit === 'km' ? v.clone().divideScalar(1000) : v;
  const formatter = (n: number) =>
    unit === 'km'
      ? kmFormatter.format(n).replace(' ', '')
      : mFormatter.format(n).replace(' ', '');

  return (
    `(${base.toArray().map(formatter).join(', ')})` +
    (mag ? '-->' + formatter(base.length()) : '')
  );
}
