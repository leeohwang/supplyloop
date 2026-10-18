// Fictional demo definitions only. No credentials or privileged keys.
export const schools = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'School A', slug: 'school-a', enabled_categories: ['clothing', 'textbook'], pickup_label: 'Main office pickup', term_label: 'Demo term' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'School B', slug: 'school-b', enabled_categories: ['clothing', 'textbook'], pickup_label: 'Main office pickup', term_label: 'Demo term' },
];

const clothing = (title, garment_type, size_label, color_variant, condition = 'good', measurements = null, measurement_unit = null) => ({
  title, condition, garment_type, size_system: size_label ? 'letter' : null, size_label, color_variant, measurements, measurement_unit,
});
const textbook = (title, edition, condition = 'good') => ({
  title, condition, isbn13: '9780000000002', edition, book_format: 'Paperback', course_label: 'Demo mathematics', book_term_label: 'Demo term', requires_digital_code: false, is_consumable: false,
});

export const inventory = [
  { school: 'school-a', category: 'clothing', storage: 'A-C1', status: 'available', details: clothing('Green school shirt', 'shirt', 'M', 'Green', 'good', 'Chest width 48; length 65', 'cm') },
  { school: 'school-a', category: 'clothing', storage: 'A-C2', status: 'available', details: clothing('Navy school sweater', 'sweater', 'S', 'Navy', 'like_new') },
  { school: 'school-a', category: 'clothing', storage: 'A-C3', status: 'available', details: clothing('Black school trousers', 'trousers', 'L', 'Black', 'fair', 'Waist 32; inseam 30', 'in') },
  { school: 'school-a', category: 'textbook', storage: 'A-B1', status: 'available', details: textbook('Demo algebra textbook, edition 2', '2', 'like_new') },
  { school: 'school-a', category: 'textbook', storage: 'A-B2', status: 'available', details: textbook('Demo algebra textbook, edition 1', '1') },
  { school: 'school-a', category: 'clothing', storage: null, status: 'intake', details: clothing('Draft jacket pending inspection', 'jacket', null, null, null) },
  { school: 'school-a', category: 'clothing', storage: 'A-C4', status: 'retired', details: clothing('Damaged grey jacket', 'jacket', 'XL', 'Grey', 'fair') },
  { school: 'school-b', category: 'clothing', storage: 'B-C1', status: 'available', details: clothing('Green school shirt', 'shirt', 'M', 'Green', 'new') },
  { school: 'school-b', category: 'clothing', storage: 'B-C2', status: 'available', details: clothing('Navy school skirt', 'skirt', 'XS', 'Navy', 'good') },
  { school: 'school-b', category: 'clothing', storage: 'B-C3', status: 'available', details: clothing('Grey school jacket', 'jacket', 'XXL', 'Grey', 'like_new') },
  { school: 'school-b', category: 'textbook', storage: 'B-B1', status: 'available', details: textbook('Demo algebra textbook, edition 2', '2', 'new') },
];
