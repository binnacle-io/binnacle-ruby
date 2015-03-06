require 'forwardable'
require 'faraday'

module Binnacle
  class Connection
    extend Forwardable

    attr_reader :connection
    attr_accessor :url

    def_delegators :@connection, :get, :post, :put, :delete, :head, :patch, :options

    def initialize(api_key, api_secret, url = nil)
      self.url = url || ENV['BINNACLE_URL']

      raise Binnacle::ConfigurationError.new("Binnacle URL not provided, set BINNACLE_URL or provided in the constructor") unless self.url

      @connection ||= Faraday.new(:url => self.url) do |faraday|
        faraday.request :basic_auth, api_key, api_secret
        faraday.request  :url_encoded             # form-encode POST params
        #faraday.response :logger                  # log requests to STDOUT TODO set a client log file
        faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
      end
      #
      # @connection.basic_auth api_key, api_secret
      # @connection
    end
  end

end
