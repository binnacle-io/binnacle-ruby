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

    def initialize(api_key, api_secret, url = nil)
      @contact_url = url || ENV['BINNACLE_URL']
      @active_url = @contact_url
      @api_key = api_key
      @api_secret = api_secret

      raise Binnacle::ConfigurationError.new("Binnacle URL not provided, set BINNACLE_URL or provided in the constructor") unless @contact_url

      build_connection
      randomize_endpoint
    end

    def endpoints
      response = @connection.get do |req|
        req.url "/api/endpoints"
        req.headers['Content-Type'] = 'application/json'
      end

      JSON.parse(response.body)
    end

    def randomize_endpoint()
      list = endpoints
      if endpoints.size > 1
        uri = URI.parse(url)
        endpoint = endpoints.sample
        @active_url = "#{uri.scheme}://#{endpoint}:#{uri.port}"
        build_connection()
      end
    end

    def build_connection()
      @connection ||= Faraday.new(:url => @active_url) do |faraday|
        faraday.request :basic_auth, @api_key, @api_secret
        faraday.request  :url_encoded             # form-encode POST params
        #faraday.response :logger                  # log requests to STDOUT TODO set a client log file
        faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
      end
    end

  end

end
