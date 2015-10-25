require 'forwardable'
require 'faraday'
require 'uri'

module Binnacle
  class Connection
    extend Forwardable

    attr_reader :connection
    attr_reader :active_url
    attr_reader :contact_url

    def_delegators :@connection, :get, :post, :put, :delete, :head, :patch, :options

    def initialize(api_key = nil, api_secret = nil, url = nil)
      @contact_url = url || Binnacle.configuration.url
      @active_url = @contact_url
      @api_key = api_key || Binnacle.configuration.api_key
      @api_secret = api_secret || Binnacle.configuration.api_secret

      raise Binnacle::ConfigurationError.new("Binnacle URL not provided, set BINNACLE_URL or provide in the constructor") unless @contact_url

      build_connection
      randomize_endpoint
    end

    def endpoints
      begin
        response = @connection.get do |req|
          req.url "/api/endpoints"
          req.headers['Content-Type'] = 'application/json'
        end

        if response.status == 401
          Binnacle.logger.error("Error communicating with Binnacle: #{response.body}")
          []
        else
          JSON.parse(response.body)
        end
      rescue Faraday::Error::ConnectionFailed => cf
        Binnacle.logger.error("Error communicating with Binnacle: #{cf.message}")
        []
      end
    end

    def randomize_endpoint
      fresh_endpoints = endpoints
      if fresh_endpoints.size > 1
        Binnacle.configuration.endpoint = fresh_endpoints
        @active_url = Binnacle.configuration.url
        build_connection()
      end
    end

    def build_connection
      begin
        @connection ||= Faraday.new(:url => @active_url) do |faraday|
          faraday.request :basic_auth, @api_key, @api_secret
          faraday.request  :url_encoded             # form-encode POST params
          #faraday.response :logger                  # log requests to STDOUT TODO set a client log file
          faraday.adapter :httpclient
        end
      rescue Faraday::Error::ConnectionFailed => cf
        Binnacle.logger.error("Error communicating with Binnacle: #{cf.message}")
      end
    end

  end

end
