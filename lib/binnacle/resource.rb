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

    def self.get(connection, path, query_params)
      response = connection.get do |req|
        req.url path
        req.headers['Content-Type'] = 'application/json'
        query_params.each do |n,v|
          req.params[n] = v if v
        end
      end

      JSON.parse(response.body).map { |r| self.from_hash(r) }
    end
  end
end
