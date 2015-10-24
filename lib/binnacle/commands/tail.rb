require 'faye/websocket'
require 'addressable/uri'
require 'eventmachine'
require 'json'

module Binnacle::Commands

  def self.tail
    opts = Trollop::options do
      banner TAIL_BANNER
      opt(:host, "Binnacle Host", type: :string, default: 'localhost')
      opt(:context, "Binnacle Context", type: :string)
      opt(:app, "Binnacle App",  type: :string)
      opt(:api_key, "Binnacle API Key", type: :string, short: '-u')
      opt(:api_secret, "Binnacle API Secret", type: :string, short: '-p')
      opt(:follow, "Monitors a Binnacle Context or App")
      opt(:lines, "Get the last n events on the Channel", type: :int, short: '-n')
      opt(:since, "Number of minutes in the past to search for events", type: :int)
      opt(:encrypted, "Use SSL/HTTPS", default: true)
    end

    if (errors = validate(opts)).empty?
      dispatch(opts)
    else
      puts "The following errors prevented the tail command from executing:"
      errors.each { |e| puts "  - #{e}" }
      puts "\nSUBCOMMAND"
      puts "      tail -- listen to a Binnacle context or app\n\n"
      Trollop::educate
    end
  end

  def self.validate(opts)
    errors = []
    errors << "No endpoint given" unless opts[:host_given]
    errors << "No context or app given" unless (opts[:context_given] || opts[:app_given])
    errors << "No authentication information given" unless (opts[:api_key_given] && opts[:api_secret_given])
    errors << "Cannot use both 'follow' and 'lines'" if (opts[:follow_given] && opts[:lines_given])
    errors << "Cannot use both 'app' and 'context'" if (opts[:context_given] && opts[:app_given])
    errors << "Lines subcommand does not support montoring of Apps at this moment" if (opts[:lines_given] && opts[:app_given])
    errors
  end

  def self.dispatch(opts)
    # tail --follow
    if opts[:follow_given] && opts[:app_given]
      monitor(opts[:host], opts[:api_key], opts[:api_secret], opts[:app], true)
    elsif opts[:follow_given] && opts[:context_given]
      monitor(opts[:host], opts[:api_key], opts[:api_secret], opts[:context])
    end

    # tail --lines
    lines(opts[:host], opts[:api_key], opts[:api_secret], opts[:context], opts[:lines], opts[:since], opts[:encrypted_given] ? opts[:encrypted] : false) if opts[:lines_given]
  end

  #
  # tail --follow --host=my_host --channel=my_channel
  def self.monitor(host, api_key, api_secret, channel, is_app = false, encrypted = true)
    EM.run do
      Signal.trap("INT")  { EventMachine.stop }
      Signal.trap("TERM") { EventMachine.stop }

      ws = Faye::WebSocket::Client.new(build_ws_url(host, api_key, api_secret, channel, is_app, encrypted))

      ws.on :open do |event|
        puts "Monitoring #{is_app ? 'App' : 'Context'} #{channel}..."
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
  def self.lines(host, api_key, api_secret, context, lines, since, encrypted = true)
    puts "Retrieving last #{lines} lines since #{since} minutes ago from Context #{context} ..."
    Binnacle.configuration.encrypted = encrypted
    client = Binnacle::Client.new(api_key, api_secret, host)

    client.recents(lines, since, context).each do |e|
      puts %[#{e.log_level} \[#{e.event_time}\] #{e.event_name} :: clientId=#{e.client_id}, sessionId=#{e.session_id}, tags=#{e.tags}]
    end
  end

  protected

  def self.build_ws_url(host, api_key, api_secret, channel, is_app = false, encrypted = true)
    Addressable::URI.new(
      host: host,
      port: Binnacle::Configuration::DEFAULT_PORT,
      scheme: encrypted ? 'ws' : 'wss',
      path: ["/api/subscribe", is_app ? "app" : "ctx", channel].join("/"),
      query: build_ws_query(api_key, api_secret)
    ).to_s
  end

  def self.build_ws_query(api_key, api_secret)
    {
      "Authorization": %[Basic #{Base64.encode64("#{api_key}:#{api_secret}").strip}],
      "X-Atmosphere-tracking-id": "0",
      "X-Atmosphere-Framework": "2.2.7-jquery",
      "X-Atmosphere-Transport": "websocket",
      "Content-Type": "application/json",
      "X-atmo-protocol": "true"
    }.map { |n,v| "#{n}=#{v}" }.join("&")
  end
end

TAIL_BANNER = <<-EOS
Usage:
   binnacle tail

where [options] are:

EOS
