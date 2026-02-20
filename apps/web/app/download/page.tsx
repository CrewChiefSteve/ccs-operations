"use client";

import { Smartphone, Download, QrCode, ClipboardList, Package, AlertTriangle, CheckCircle } from "lucide-react";

const FEATURES = [
  {
    icon: QrCode,
    title: "QR Scanning",
    description: "Scan PO barcodes, location QR codes, and component part numbers with the built-in camera.",
  },
  {
    icon: ClipboardList,
    title: "PO Receiving",
    description: "Receive shipments line-by-line, capture photos, and update stock levels in real time.",
  },
  {
    icon: Package,
    title: "Inventory Counts",
    description: "Walk the warehouse, scan locations, and submit counts with variance highlighting.",
  },
  {
    icon: AlertTriangle,
    title: "Alerts & Tasks",
    description: "View and action agent-generated alerts and tasks directly from the floor.",
  },
];

export default function DownloadPage() {
  const apkUrl = "/downloads/ccs-operations.apk";
  const currentVersion = "1.0.0";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Mobile App</h1>
        <p className="mt-1 text-sm text-text-secondary">
          CCS Operations for Android — warehouse receiving, inventory counts, and task management on the go.
        </p>
      </div>

      {/* Download Card */}
      <div className="rounded-xl border border-surface-4 bg-surface-1 p-6">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/10">
            <Smartphone size={32} className="text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-text-primary">
              CCS Operations
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              Version {currentVersion} &middot; Android
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href={apkUrl}
                download
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
              >
                <Download size={16} />
                Download APK
              </a>
              <span className="text-xs text-text-tertiary">
                Requires Android 8.0+
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Install Instructions */}
      <div className="rounded-xl border border-surface-4 bg-surface-1 p-6">
        <h3 className="text-base font-semibold text-text-primary">Installation</h3>
        <ol className="mt-4 space-y-3 text-sm text-text-secondary">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
              1
            </span>
            <span>
              Tap <strong className="text-text-primary">Download APK</strong> above on your Android device (or transfer the file from your computer).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
              2
            </span>
            <span>
              Open the downloaded file. If prompted, allow installation from unknown sources in your device settings.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
              3
            </span>
            <span>
              Open <strong className="text-text-primary">CCS Operations</strong> and sign in with your Google account.
            </span>
          </li>
        </ol>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-base font-semibold text-text-primary">What you can do</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-surface-4 bg-surface-1 p-4"
            >
              <div className="flex items-center gap-2.5">
                <feature.icon size={16} className="text-accent" />
                <h4 className="text-sm font-medium text-text-primary">
                  {feature.title}
                </h4>
              </div>
              <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
        <div className="text-xs text-text-secondary leading-relaxed">
          <strong className="text-amber-400">Coming soon:</strong> This app will be available on the Google Play Store.
          Until then, download the APK directly from this page.
        </div>
      </div>
    </div>
  );
}
