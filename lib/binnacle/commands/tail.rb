require 'faye/websocket'
require 'eventmachine'
require 'json'

module Binnacle::Commands
  def self.tail
    opts = Trollop::options do
      opt :channel, "Binnacle Channel", :type => :string
      opt :host, "Binnacle Server", :type => :string

      opt :follow, 'Monitors a Binnacle Channel', :short => '-f'
      opt :lines, "Get the last n events on the Channel", :type => :int, :short => '-n'
      opt :since, "Number of minutes in the past to search for events", :type => :int, :short => '-s'
    end

    if opts[:host_given] && opts[:channel_given]
      monitor(opts[:host], opts[:channel]) if opts[:follow_given] && opts[:follow]
      lines(opts[:host], opts[:channel], opts[:lines], opts[:since]) if opts[:lines_given]
    else
      puts "Error. No channel given"
    end
  end

  #
  # tail --follow --host=my_host --channel=my_channel
  def self.monitor(host, channel)
    EM.run do
      Signal.trap("INT")  { EventMachine.stop }
      Signal.trap("TERM") { EventMachine.stop }

      ws = Faye::WebSocket::Client.new("ws://#{host}/api/subscribe/#{channel}/?X-Atmosphere-tracking-id=0&X-Atmosphere-Framework=2.2.7-jquery&X-Atmosphere-Transport=websocket&Content-Type=application/json&X-atmo-protocol=true")

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

  #
  # tail --lines=50 --since=10 --host=my_host --channel=my_channel
  def self.lines(host, context_id, lines, since = nil)

    client = Binnacle::Client.for_host("http://#{host}")

    client.recents(lines, since, context_id).each do |e|
      puts %[#{e.log_level} \[#{e.event_time}\] #{e.event_name} :: clientId=#{e.client_id}, sessionId=#{e.session_id}, tags=#{e.tags}]
    end
  end
end
