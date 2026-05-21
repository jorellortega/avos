import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f8f5',
        }}
      >
        <svg viewBox="0 0 40 40" width="160" height="160">
          <ellipse cx="20" cy="20" rx="18" ry="20" fill="#4a7c59" />
          <ellipse cx="20" cy="20" rx="10" ry="12" fill="#8fbc8f" />
          <ellipse cx="20" cy="20" rx="4" ry="5" fill="#654321" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
