import Image from "next/image";

type ReciproLogoProps = {
  width?: number;
};

export default function ReciproLogo({ width = 200 }: ReciproLogoProps) {
  return (
    <Image
      src="/logos/logo-recipro.svg"
      alt="Recipro"
      width={width}
      height={width / 2}
      priority
    />
  );
}
