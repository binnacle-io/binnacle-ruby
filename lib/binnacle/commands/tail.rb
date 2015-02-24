require 'faye/websocket'
require 'eventmachine'
require 'json'

module Binnacle::Commands
  def self.tail
    opts = Trollop::options do
      opt :f, "Monitors a Binnacle Channel"
      opt :channel, "Binnacle Channel", :type => :string
    end

    monitor(opts[:channel]) if opts[:f] && opts[:channel_given]
  end

  #
  # tail -f --channel=my_channel
  def self.monitor(channel)
    EM.run do
      Signal.trap("INT")  { EventMachine.stop }
      Signal.trap("TERM") { EventMachine.stop }

      ws = Faye::WebSocket::Client.new("ws://localhost:8080/api/subscribe/#{channel}/?X-Atmosphere-tracking-id=0&X-Atmosphere-Framework=2.2.7-jquery&X-Atmosphere-Transport=websocket&Content-Type=application/json&X-atmo-protocol=true")

      ws.on :open do |event|
        puts "Monitoring channel #{channel}..."
      end

      ws.on :message do |event|
        if event.data !~ /\s/
          data = JSON.parse event.data
          tags = data['tags'].join(',')
          puts %[#{data['logLevel']} \[#{Time.at(data['eventTime']/1000)}\] #{data['eventName']} :: clientId=#{data['clientId']}, sessionId=#{data['eventName']}, tags=#{tags}]
        end
      end

      ws.on :close do |event|
        ws = nil
      end
    end
  end
end
