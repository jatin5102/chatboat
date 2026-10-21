import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Property } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export const PROPERTIES: Property[] = [
  {
    id: 'prop-1',
    name: 'Skyline Heights Luxury Towers',
    tagline: '3 & 4 BHK Ultra-Modern Sky Residences',
    location: 'Sector 62, Golf Course Ext Road, Gurgaon',
    priceRange: '₹2.85 Cr - ₹4.50 Cr',
    reraNumber: 'RC/REP/HARERA/GGM/2024/891',
    description:
      'Skyline Heights offers panoramic skyline views, private elevators, VRV air conditioning, Italian marble flooring, and smart home automation.',
    amenities: [
      'Infinity Rooftop Pool',
      'Clubhouse & Gym',
      'Spa & Sauna',
      'Multi-tier 24x7 Security',
      'EV Charging Stations'
    ],
    brochurePath: path.join(rootDir, 'assets/properties/skyline/brochure.pdf'),
    imagePaths: [
      path.join(rootDir, 'assets/properties/skyline/elevation.jpg'),
      path.join(rootDir, 'assets/properties/skyline/living_room.jpg'),
      path.join(rootDir, 'assets/properties/skyline/master_bedroom.jpg')
    ]
  },
  {
    id: 'prop-2',
    name: 'Green Valley Elite Villas',
    tagline: '4 & 5 BHK Private Forest Villa Living',
    location: 'Whitefield - Sarjapur Link Road, Bangalore',
    priceRange: '₹3.90 Cr - ₹6.80 Cr',
    reraNumber: 'PRM/KA/RERA/1251/446/PR/230915',
    description:
      'Green Valley Villas is nestled in 25 acres of lush greenery with private plunge pools, zen gardens, and solar power backup.',
    amenities: [
      'Private Swimming Pool',
      'Zen Garden & Walking Track',
      'Clubhouse with Squash Court',
      'Solar Powered Grid',
      'Kids Adventure Zone'
    ],
    brochurePath: path.join(rootDir, 'assets/properties/greenvalley/brochure.pdf'),
    imagePaths: [
      path.join(rootDir, 'assets/properties/greenvalley/villa_front.jpg'),
      path.join(rootDir, 'assets/properties/greenvalley/villa_interior.jpg')
    ]
  }
];

export function getPropertyById(id: string): Property | undefined {
  return PROPERTIES.find((p) => p.id === id);
}
