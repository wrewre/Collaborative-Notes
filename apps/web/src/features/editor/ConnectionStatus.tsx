interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting'
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = {
    connected: { color: 'bg-emerald-400', text: 'Live', textColor: 'text-emerald-400' },
    connecting: { color: 'bg-amber-400 animate-pulse', text: 'Connecting', textColor: 'text-amber-400' },
    disconnected: { color: 'bg-red-400', text: 'Offline', textColor: 'text-zinc-500' },
  }[status]

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className={config.textColor}>{config.text}</span>
    </div>
  )
}
