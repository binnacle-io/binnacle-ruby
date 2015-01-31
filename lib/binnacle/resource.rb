require 'hashie'
require 'json'

module Binnacle
  class Resource
    attr_reader :route
    attr_writer :connection

    def post()
      response = @connection.post do |req|
        req.url self.route
        req.headers['Content-Type'] = 'application/json'
        req.body = self.to_json
      end

      JSON.parse(response.body)
    end
  end
end
