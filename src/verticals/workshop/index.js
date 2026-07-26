import { Car, ClipboardCheck, Package, Boxes } from 'lucide-react';

/**
 * Vertical Pack #1 — Workshop / tyre & mechanical.
 * A pack adds nav sections (and later: routes, entities, settings) on top of
 * the generic core. The workshop domain logic is ported from Platform OS v2.5.
 *
 * A tenant with vertical = "workshop" gets these; other verticals won't.
 */
export const workshopPack = {
  id: 'workshop',
  label: 'Workshop',
  sections: [
    {
      title: 'Workshop',
      items: [
        { key: 'vehicles', label: 'Vehicles', icon: Car },
        { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
        { key: 'parts', label: 'Parts & Tyres', icon: Package },
        { key: 'stock', label: 'Stock Take', icon: Boxes },
      ],
    },
  ],
};
