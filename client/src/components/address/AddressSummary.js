"use client";

import { useLocale } from "next-intl";
import { useDistricts } from "@/lib/useDistricts";
import { districtName } from "@/lib/districtName";

// An address as a few short lines, with the district name in the site language.
export default function AddressSummary({ address }) {
  const locale = useLocale();
  const districts = useDistricts();

  return (
    <div className="text-sm text-ink">
      <div className="font-medium">{address.fullName}</div>
      <div>{[address.addressLine1, address.addressLine2].filter(Boolean).join(", ")}</div>
      <div>{[address.city, districtName(districts, address.district, locale) || address.district, address.postalCode].filter(Boolean).join(", ")}</div>
      <div className="text-subtle">{address.phone}</div>
    </div>
  );
}
