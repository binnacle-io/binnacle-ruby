require 'forwardable'
require 'faraday'
require 'uri'

module Binnacle
  class Connection
    extend Forwardable

    attr_reader :connection
    attr_accessor :url

    def_delegators :@connection, :get, :post, :put, :delete, :head, :patch, :options

    def initialize(api_key, api_secret, url = nil)
      self.url = url || ENV['BINNACLE_URL']

      raise Binnacle::ConfigurationError.new("Binnacle URL not provided, set BINNACLE_URL or provided in the constructor") unless self.url

      build_connection(self.url)
      randomize_endpoint
    end

    def endpoints
      response = @connection.get do |req|
        req.url "/api/endpoints"
        req.headers['Content-Type'] = 'application/json'
      end

      JSON.parse(response.body)
    end

    def randomize_endpoint
      list = endpoints
      if endpoints.size > 1
        uri = URI.parse(url)
        endpoint = endpoints.sample
        build_connection("#{uri.scheme}://#{endpoint}:#{uri.port}")
      end
    end

    def build_connection(url)
      @connection ||= Faraday.new(:url => url) do |faraday|
        faraday.request :basic_auth, api_key, api_secret
        faraday.request  :url_encoded             # form-encode POST params
        #faraday.response :logger                  # log requests to STDOUT TODO set a client log file
        faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
      end
    end

  end

end
