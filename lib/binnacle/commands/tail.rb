require 'faye/websocket'
require 'addressable/uri'
require 'eventmachine'
require 'json'
require 'colorize'

module Binnacle::Commands

  def self.tail
    if ENV["TEST_MODE"] == 'true'
      String.disable_colorization = true
    end

    opts = Trollop::options do
      banner TAIL_BANNER
      opt(:host, "Binnacle Host", type: :string, default: 'localhost')
      opt(:channel, "Binnacle Channel", type: :string)
      opt(:app, "Binnacle App",  type: :string)
      opt(:api_key, "Binnacle API Key", type: :string, short: '-u')
      opt(:api_secret, "Binnacle API Secret", type: :string, short: '-p')
      opt(:follow, "Monitors a Binnacle Channel or App")
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
      puts "      tail -- listen to a Binnacle channel or app\n\n"
      Trollop::educate unless ENV["TEST_MODE"] == 'true'
    end
  end

  def self.validate(opts)
    errors = []
    errors << "No channel or app given" unless (opts[:channel_given] || opts[:app_given])
    errors << "No authentication information given" unless (opts[:api_key_given] && opts[:api_secret_given])
    errors << "Cannot use both 'follow' and 'lines'" if (opts[:follow_given] && opts[:lines_given])
    errors << "Cannot use both 'app' and 'channel'" if (opts[:channel_given] && opts[:app_given])
    errors << "Lines subcommand does not support montoring of Apps at this moment" if (opts[:lines_given] && opts[:app_given])
    errors
  end

  def self.dispatch(opts)
    # tail --follow
    if opts[:follow_given] && opts[:app_given]
      monitor(opts[:host], opts[:api_key], opts[:api_secret], opts[:app], true, opts[:encrypted])
    elsif opts[:follow_given] && opts[:channel_given]
      monitor(opts[:host], opts[:api_key], opts[:api_secret], opts[:channel], false, opts[:encrypted])
    end

    # tail --lines
    lines(opts[:host], opts[:api_key], opts[:api_secret], opts[:channel], opts[:lines], opts[:since], opts[:encrypted_given] ? opts[:encrypted] : false) if opts[:lines_given]
  end

  #
  # tail --follow --host=my_host --channel=my_channel
  def self.monitor(host, api_key, api_secret, channel, is_app = false, encrypted = true)
    EM.run do
      Signal.trap("INT")  { EventMachine.stop }
      Signal.trap("TERM") { EventMachine.stop }

      ws_url = build_ws_url(host, api_key, api_secret, channel, is_app, encrypted)
      ws = Faye::WebSocket::Client.new(ws_url)

      ws.on :open do |event|
        puts "Monitoring #{is_app ? 'App' : 'Channel'} #{channel} on #{host}..."
      end

      ws.on :message do |event|
        if event.data !~ /\s/ && event.data != 'X'
          print_event_from_json(event.data)
        end
      end

      ws.on :close do |event|
        ws = nil
      end
    end
  end

  #
  # tail --lines=50 --since=10 --host=my_host --channel=my_channel
  def self.lines(host, api_key, api_secret, channel, lines, since, encrypted = true)
    puts "Retrieving last #{lines} lines since #{since} minutes ago from Channel #{channel} ..."
    Binnacle.configuration.encrypted = encrypted
    client = Binnacle::Client.new(api_key, api_secret, host)

    client.recents(lines, since, channel).each do |e|
      print_event(e)
    end
  end

  protected

  def self.build_ws_url(host, api_key, api_secret, channel, is_app = false, encrypted = true)
    Addressable::URI.new(
      host: host,
      port: Binnacle::Configuration::DEFAULT_PORT,
      scheme: encrypted ? 'wss' : 'ws',
      path: ["/api/subscribe", is_app ? "app" : "channel", channel].join("/"),
      query: build_ws_query(api_key, api_secret)
    ).to_s
  end

  def self.build_ws_query(api_key, api_secret)
    {
      "Authorization" => %[Basic #{Base64.encode64("#{api_key}:#{api_secret}").strip}],
      "X-Atmosphere-tracking-id" => "0",
      "X-Atmosphere-Framework" => "2.3.2-javascript",
      "X-Atmosphere-Transport" => "websocket",
      "Content-Type" => "application/json",
      "X-atmo-protocol" => "true"
    }.map { |n,v| "#{n}=#{v}" }.join("&")
  end

  def self.print_event(event)
    message = ""

    level = '%-10.10s' % event.log_level

    level = case
    when ['INFO', 'EXPORT_JOB'].include?(level)
      level.colorize(:blue)
    when ['WARN', 'WARNING', 'OVERAGE'].include?(level)
      level.colorize(:yellow)
    when ['ERROR', 'FATAL', 'DELIVERY_FAILURE', 'EXCEPTION', 'OOPS', 'MYBAD'].include?(level)
      level.colorize(:red)
    when ['DEBUG'].include?(level)
      level.colorize(:cyan)
    when ['UNKNOWN'].include?(level)
      level.colorize(:magenta)
    else
      level.colorize(:blue)
    end.colorize(mode: :bold)

    message << "#{level} [#{Time.at(event.event_time)}] "

    message << ('%-10.10s' % event.event_name).colorize(color: :green, mode: :bold)

    rest = []

    unless event.client_id.nil? || event.client_id.empty?
      rest << " #{'client_id'.colorize(mode: :bold)} = #{event.client_id}"
    end

    unless event.session_id.nil? || event.session_id.empty?
      rest << "#{'session_id'.colorize(mode: :bold)} = #{event.session_id}"
    end

    unless event.ip_address.nil? || event.ip_address.empty?
      rest << "#{'ip'.colorize(mode: :bold)} = #{('%-15.15s' % event.ip_address)}"
    end

    unless event.tags.empty?
      tags = event.tags.join(',')
      rest << "#{'tags'.colorize(mode: :bold)} = [#{event.tags}]"
    end

    message << " :: ".colorize(mode: :bold) + rest.join(", ") unless rest.empty?

    puts message
  end

  def self.print_event_from_json(json)
    begin
      data = JSON.parse(json)
      event = Binnacle::Event.from_hash(data)
      print_event(event)
    rescue JSON::ParserError => jpe
      # do nothing!
    end
  end

end

TAIL_BANNER = <<-EOS
Usage:
   binnacle tail [options]

where [options] are:

EOS
