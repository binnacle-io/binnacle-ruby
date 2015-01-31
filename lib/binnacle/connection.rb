require 'forwardable'
require 'faraday'

module Binnacle
  class Connection
    extend Forwardable

    attr_reader :connection
    attr_accessor :url

    def_delegators :@connection, :get, :post, :put, :delete, :head, :patch, :options

    def initialize(url = nil)
      self.url = url || ENV['BINNACLE_URL']

      raise Binnacle::ConfigurationError.new("Binnacle URL not provided, set BINNACLE_URL or pass it to") unless self.url

      @connection ||= Faraday.new(:url => self.url) do |faraday|
        faraday.request  :url_encoded             # form-encode POST params
        faraday.response :logger                  # log requests to STDOUT
        faraday.adapter  Faraday.default_adapter  # make requests with Net::HTTP
      end
    end
  end

end
