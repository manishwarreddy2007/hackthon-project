export const locationOptions = [
  'Hyderabad', 'Bengaluru', 'Chennai', 'Mumbai', 'Delhi', 'Pune', 'Vijayawada', 'Visakhapatnam', 'Kochi', 'Kolkata',
]

export function getDonationImage(title = '', category = '') {
  const name = title.toLowerCase()
  if (/biryani|rice|pulao|dal/.test(name)) return '/food-rice.jpg'
  if (/fruit cup/.test(name)) return '/food-dairy.jpg'
  if (/fruit|produce|vegetable/.test(name) || category === 'Produce') return '/food-produce.jpg'
  if (/bread|bakery|bun|pastry|cake/.test(name) || category === 'Bakery') return '/food-bakery.jpg'
  if (category === 'Fruit') return '/food-dairy.jpg'
  return '/food-meals.jpg'
}

